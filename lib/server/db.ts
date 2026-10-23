import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { SPORT_PRESETS } from "../sports";
import { SCHEMA } from "./schema";

/**
 * Base SQLite intégrée à Node (module `node:sqlite`, aucune dépendance), dans un fichier sur le disque du serveur :
 * DATA_DIR/matchzy.db (par défaut ./data en développement). Comme pour Team Sezen, le dossier de données est
 * hors du dossier du code : un déploiement ne le touche jamais.
 *
 * Le client reproduit la petite partie de l'API « postgres.js » dont l'application a besoin :
 *   sql`select * from matches where id = ${id}`      → Promise<lignes[]>
 *   sql`insert into teams ${sql(lignes)}`            → insertion d'une ou plusieurs lignes
 *   sql`update matches set ${sql(patch, colonnes)}`  → affectations « col = ? »
 *   sql`… where id in ${sql(ids)}`                   → liste de valeurs
 *   db().begin(async (sql) => …)                     → transaction
 * Les colonnes JSON et booléennes sont converties à la lecture comme à l'écriture.
 */

/** Colonnes stockées en JSON (texte) et colonnes booléennes (0/1), décodées à la lecture. */
const JSON_COLUMNS = new Set(["rules", "home_source", "away_source", "sets", "shootout"]);
const BOOL_COLUMNS = new Set(["is_preset", "third_place", "withdrawn", "is_bye"]);

type Row = Record<string, unknown>;

class Fragment {
  constructor(
    readonly kind: "values" | "set" | "list" | "json",
    readonly value: unknown,
    readonly cols?: string[],
  ) {}
}

function encode(v: unknown): SQLInputValue {
  if (v === undefined || v === null) return null;
  if (v instanceof Fragment) return JSON.stringify(v.value);
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return v as SQLInputValue;
}

/** Ligne lue → objet ordinaire (node:sqlite renvoie des objets sans prototype, refusés par React côté client). */
function decode(raw: Row): Row {
  const row: Row = {};
  for (const k of Object.keys(raw)) {
    const v = raw[k];
    if (v === null) row[k] = null;
    else if (JSON_COLUMNS.has(k) && typeof v === "string") row[k] = JSON.parse(v);
    else if (BOOL_COLUMNS.has(k)) row[k] = v === 1 || v === true;
    else row[k] = v;
  }
  return row;
}

const ident = (c: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(c)) throw new Error(`Colonne invalide : ${c}`);
  return c;
};

/** Construit la requête paramétrée à partir du gabarit. */
function compile(strings: TemplateStringsArray, values: unknown[]): { text: string; params: SQLInputValue[] } {
  let text = strings[0];
  const params: SQLInputValue[] = [];
  values.forEach((v, i) => {
    if (v instanceof Fragment && v.kind === "values") {
      const rows = (Array.isArray(v.value) ? v.value : [v.value]) as Row[];
      // Union des colonnes renseignées : une ligne sans valeur pour une colonne reçoit NULL.
      const cols = [...new Set(rows.flatMap((r) => Object.keys(r).filter((c) => r[c] !== undefined)))];
      text += `(${cols.map(ident).join(", ")}) values ${rows.map(() => `(${cols.map(() => "?").join(", ")})`).join(", ")}`;
      for (const r of rows) for (const c of cols) params.push(encode(r[c]));
    } else if (v instanceof Fragment && v.kind === "set") {
      const r = v.value as Row;
      text += v.cols!.map((c) => `${ident(c)} = ?`).join(", ");
      for (const c of v.cols!) params.push(encode(r[c]));
    } else if (v instanceof Fragment && v.kind === "list") {
      const list = v.value as unknown[];
      text += `(${list.map(() => "?").join(", ") || "null"})`;
      for (const x of list) params.push(encode(x));
    } else {
      text += "?";
      params.push(encode(v));
    }
    text += strings[i + 1];
  });
  return { text, params };
}

export interface Sql {
  <T = Row[]>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  /** Lignes à insérer (objet ou tableau d'objets), affectations (avec `cols`) ou liste de valeurs. */
  (value: object | unknown[], cols?: string[]): Fragment;
  json(value: unknown): Fragment;
  begin<T>(fn: (sql: Sql) => Promise<T>): Promise<T>;
  end(): Promise<void>;
}

/** Client utilisable hors transaction ou dans une transaction. */
export type Q = Sql;

const globalForDb = globalThis as unknown as { __matchzyDb?: DatabaseSync; __matchzySql?: Sql; __matchzyLock?: Promise<unknown> };

export function dataDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || path.join(process.cwd(), "data"));
}

function open(): DatabaseSync {
  if (globalForDb.__matchzyDb) return globalForDb.__matchzyDb;
  const dir = dataDir();
  mkdirSync(dir, { recursive: true });
  const conn = new DatabaseSync(path.join(dir, "matchzy.db"));
  conn.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;");
  conn.exec(SCHEMA);
  // Préréglages de sports : ajoutés s'ils manquent, jamais écrasés (ils ont pu être modifiés dans l'application).
  const insert = conn.prepare("insert or ignore into sports (id, slug, name, rules, is_preset) values (?, ?, ?, ?, 1)");
  for (const p of SPORT_PRESETS) insert.run(crypto.randomUUID(), p.slug, p.name, JSON.stringify(p.rules));
  globalForDb.__matchzyDb = conn;
  return conn;
}

/**
 * File d'attente des transactions : le pilote est synchrone, mais les fonctions de l'application sont
 * asynchrones ; une transaction à la fois, les autres attendent leur tour (deux terrains qui valident ensemble).
 */
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const prev = globalForDb.__matchzyLock ?? Promise.resolve();
  const run = prev.then(fn, fn);
  globalForDb.__matchzyLock = run.catch(() => {});
  return run;
}

function makeSql(): Sql {
  const query = (strings: TemplateStringsArray, values: unknown[]) => {
    const { text, params } = compile(strings, values);
    const stmt = open().prepare(text);
    // Toutes les requêtes renvoient leurs lignes (select, ou insert/update/delete … returning).
    return /^\s*(select|with)\b|\breturning\b/i.test(text) ? (stmt.all(...params) as Row[]).map(decode) : (stmt.run(...params), []);
  };
  const sql = ((first: unknown, ...rest: unknown[]) => {
    if (Array.isArray(first) && "raw" in (first as object)) {
      try {
        return Promise.resolve(query(first as unknown as TemplateStringsArray, rest));
      } catch (e) {
        return Promise.reject(e);
      }
    }
    const cols = rest[0] as string[] | undefined;
    if (cols) return new Fragment("set", first, cols);
    if (Array.isArray(first) && first.length && typeof first[0] !== "object") return new Fragment("list", first);
    if (Array.isArray(first) && !first.length) return new Fragment("list", first);
    return new Fragment("values", first);
  }) as Sql;
  sql.json = (value) => new Fragment("json", value);
  sql.begin = (fn) =>
    serialize(async () => {
      const conn = open();
      conn.exec("BEGIN IMMEDIATE");
      try {
        const r = await fn(sql);
        conn.exec("COMMIT");
        return r;
      } catch (e) {
        conn.exec("ROLLBACK");
        throw e;
      }
    });
  sql.end = async () => {
    globalForDb.__matchzyDb?.close();
    globalForDb.__matchzyDb = undefined;
  };
  return sql;
}

/** Les secrets de session et le mot de passe organisateur sont nécessaires ; la base, elle, se crée toute seule. */
export function isConfigured(): boolean {
  return !!process.env.SESSION_SECRET && !!process.env.ORGANIZER_PASSWORD;
}

/** Client SQLite. Uniquement côté serveur. */
export function db(): Sql {
  globalForDb.__matchzySql ??= makeSql();
  return globalForDb.__matchzySql;
}

/**
 * Exécute `fn` dans une transaction : les écritures et recalculs d'un même tournoi sont sérialisés
 * (avec SQLite, toutes les transactions le sont, ce qui couvre largement le besoin).
 */
export function withTournamentLock<T>(_tournamentId: string, fn: (sql: Sql) => Promise<T>): Promise<T> {
  return db().begin(fn);
}
