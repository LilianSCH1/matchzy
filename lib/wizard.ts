// Aides de l'assistant de création : suggestions et réglages toujours valides.
import { nextPow2 } from "./bracket";
import { buildTournament, estimatedEnd, validateInput, type TournamentInput } from "./build";
import type { Format } from "./types";

export const MAX_TEAMS = 64;
export const MIN_TEAMS = 3;

/** Découpe un texte collé (une équipe par ligne, ou séparées par des virgules) et écarte les doublons. */
export function parseTeams(text: string, existing: string[]): { added: string[]; duplicates: string[]; overflow: number } {
  const lines = text.split(/\r?\n/);
  const raw = lines.length === 1 && /[,;\t]/.test(lines[0]) ? lines[0].split(/[,;\t]/) : lines;
  const seen = new Set(existing.map((t) => t.trim().toLowerCase()));
  const added: string[] = [];
  const duplicates: string[] = [];
  for (const line of raw) {
    const name = line.replace(/^\s*(\d+\s*[.)\-:]|[-•*])\s*/, "").trim();
    if (!name) continue;
    if (seen.has(name.toLowerCase())) {
      duplicates.push(name);
      continue;
    }
    seen.add(name.toLowerCase());
    added.push(name);
  }
  const room = Math.max(0, MAX_TEAMS - existing.length);
  return { added: added.slice(0, room), duplicates, overflow: Math.max(0, added.length - room) };
}

/** Noms provisoires « Équipe 1 », « Équipe 2 »… qui ne collent pas à la liste existante. */
export function placeholderTeams(count: number, existing: string[]): string[] {
  const taken = new Set(existing.map((t) => t.toLowerCase()));
  const res: string[] = [];
  for (let i = 1; res.length < count && existing.length + res.length < MAX_TEAMS; i++) {
    const name = `Équipe ${i}`;
    if (!taken.has(name.toLowerCase())) res.push(name);
  }
  return res;
}

/** Format conseillé : championnat simple si tout le monde peut se rencontrer, sinon poules puis phase finale. */
export function recommendFormat(teamCount: number): Format {
  return teamCount <= 5 ? "pools" : "pools_knockout";
}

/** Nom du premier tour d'un tableau de taille donnée. */
export function bracketStartLabel(size: number): string {
  switch (size) {
    case 2:
      return "Finale directe";
    case 4:
      return "Demi-finales";
    case 8:
      return "Quarts de finale";
    default:
      return `${size / 2}es de finale`;
  }
}

export interface QualifierOption {
  qualifiers: number;
  bestExtra: number;
  total: number;
  size: number;
  byes: number;
  title: string;
  detail: string;
}

/**
 * Combinaisons « qualifiés par poule / meilleurs suivants » valides pour ces poules.
 * Les repêchés ne sont proposés que pour compléter exactement un tableau.
 */
export function qualifierOptions(sizes: number[]): QualifierOption[] {
  if (!sizes.length) return [];
  const pools = sizes.length;
  const teams = sizes.reduce((a, b) => a + b, 0);
  const minSize = Math.min(...sizes);
  const res: QualifierOption[] = [];
  for (let q = 1; q <= minSize; q++) {
    const base = pools * q;
    const withExtra = sizes.filter((s) => s > q).length;
    const fill = nextPow2(base) - base;
    const extras = [0, ...(fill > 0 && fill <= withExtra ? [fill] : [])];
    for (const extra of extras) {
      const total = base + extra;
      if (total < 2 || total >= teams) continue;
      const size = nextPow2(total);
      const byes = size - total;
      const who = pools === 1 ? (q === 1 ? "Le 1er" : `Les ${q} premiers`) : q === 1 ? "Le 1er de chaque poule" : `Les ${q} premiers de chaque poule`;
      res.push({
        qualifiers: q,
        bestExtra: extra,
        total,
        size,
        byes,
        title: extra ? `${who} + ${extra === 1 ? `le meilleur ${q + 1}e` : `les ${extra} meilleurs ${q + 1}es`}` : who,
        detail: `${total} qualifiés · ${bracketStartLabel(size)}${byes ? ` · ${byes} exempté${byes > 1 ? "s" : ""} au 1er tour` : ""}`,
      });
    }
  }
  return res;
}

/** Option par défaut : un tableau complet (sans exemption) avec environ 2 qualifiés par poule. */
export function defaultQualifierOption(options: QualifierOption[]): QualifierOption | null {
  if (!options.length) return null;
  const score = (o: QualifierOption) => (o.byes ? 100 : 0) + Math.abs(o.qualifiers - 2) * 10 + o.bestExtra / 100;
  return [...options].sort((a, b) => score(a) - score(b))[0];
}

/** Heure de fin estimée d'une configuration, ou null si elle n'est pas valide. */
export function previewEnd(input: TournamentInput): { end: Date; matches: number } | null {
  if (validateInput(input)) return null;
  try {
    const b = buildTournament(input, { id: "preview", slug: "preview" });
    const end = estimatedEnd(b);
    return end ? { end, matches: b.matches.filter((m) => !m.is_bye).length } : null;
  } catch {
    return null;
  }
}

/** Plus longue durée de match (en minutes) qui permet de finir avant l'heure voulue, ou null si impossible. */
export function fitMatchDuration(input: TournamentInput, deadline: Date, max = 240): number | null {
  const fits = (d: number) => {
    const p = previewEnd({ ...input, matchDuration: d });
    return !!p && p.end.getTime() <= deadline.getTime();
  };
  if (!fits(1)) return null;
  let lo = 1;
  let hi = max;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(mid)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
