import type { Court, Match, Pool, Sport, Team, Tournament, TournamentBundle } from "../types";
import { db, type Q } from "./db";

/** Prépare une ligne pour l'écriture (le pilote sérialise lui-même les colonnes jsonb). */
export function toRow<T extends object>(obj: T): Record<string, any> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

export async function listTournaments(): Promise<Tournament[]> {
  return db()<Tournament[]>`select * from tournaments order by date desc, created_at desc`;
}

export async function listSports(): Promise<Sport[]> {
  return db()<Sport[]>`select * from sports order by is_preset desc, name`;
}

export async function getTournament(by: { slug?: string; id?: string }, sql: Q = db()): Promise<Tournament | null> {
  const rows = by.id
    ? await sql<Tournament[]>`select * from tournaments where id = ${by.id}`
    : await sql<Tournament[]>`select * from tournaments where slug = ${by.slug ?? ""}`;
  return rows[0] ?? null;
}

export async function loadBundle(tournament: Tournament, sql: Q = db()): Promise<TournamentBundle> {
  const id = tournament.id;
  const [pools, courts, teams, matches] = await Promise.all([
    sql<Pool[]>`select * from pools where tournament_id = ${id} order by position`,
    sql<Court[]>`select * from courts where tournament_id = ${id} order by position`,
    sql<Team[]>`select * from teams where tournament_id = ${id} order by name`,
    sql<Match[]>`select * from matches where tournament_id = ${id} order by scheduled_at nulls last`,
  ]);
  return { tournament, pools: [...pools], courts: [...courts], teams: [...teams], matches: [...matches] };
}

export async function loadBundleBySlug(slug: string): Promise<TournamentBundle | null> {
  const t = await getTournament({ slug });
  return t ? loadBundle(t) : null;
}

export async function courtCodes(tournamentId: string): Promise<Map<string, string>> {
  const rows = await db()<{ court_id: string; code: string }[]>`select court_id, code from court_codes where tournament_id = ${tournamentId}`;
  return new Map(rows.map((r) => [r.court_id, r.code]));
}
