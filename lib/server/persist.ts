import type { BuiltTournament } from "../build";
import { resolveTournament } from "../resolve";
import type { Match, Tournament, TournamentBundle } from "../types";
import { loadBundle, toRow } from "./data";
import { db, type Q } from "./db";

/** Enregistre un tournoi construit par lib/build.ts (en une transaction). */
export async function saveBuiltTournament(b: BuiltTournament): Promise<void> {
  await db().begin(async (sql) => {
    await sql`insert into tournaments ${sql(toRow(b.tournament))}`;
    if (b.pools.length) await sql`insert into pools ${sql(b.pools.map(toRow))}`;
    await sql`insert into courts ${sql(b.courts.map(toRow))}`;
    await sql`insert into court_codes ${sql(b.courtCodes.map(toRow))}`;
    await sql`insert into teams ${sql(b.teams.map(toRow))}`;
    for (let i = 0; i < b.matches.length; i += 500) await sql`insert into matches ${sql(b.matches.slice(i, i + 500).map(toRow))}`;
    await applyResolution(b, sql);
  });
}

export async function updateMatch(id: string, patch: Partial<Match>, sql: Q = db()): Promise<void> {
  const row = toRow(patch);
  const cols = Object.keys(row);
  if (!cols.length) return;
  await sql`update matches set ${sql(row, cols)} where id = ${id}`;
}

/** Recalcule forfaits, classements et tableau, puis écrit les différences en base. */
export async function applyResolution(bundle: TournamentBundle, sql: Q = db()): Promise<number> {
  const { patches } = resolveTournament(bundle);
  // Dans une transaction, les requêtes passent par une seule connexion : on les enchaîne.
  for (const [id, patch] of patches) await updateMatch(id, patch, sql);
  return patches.size;
}

/**
 * Recalcule le tournoi. À appeler dans `withTournamentLock` pour que l'écriture du résultat
 * et le recalcul soient atomiques et ne se croisent pas avec ceux d'un autre terrain.
 */
export async function recompute(t: Tournament, sql: Q): Promise<void> {
  // Les matchs sont parcourus dans l'ordre du tableau : une passe suffit, la seconde confirme la stabilité.
  for (let i = 0; i < 2; i++) {
    const n = await applyResolution(await loadBundle(t, sql), sql);
    if (n === 0) break;
  }
}
