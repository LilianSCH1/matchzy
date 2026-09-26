import type { BuiltTournament } from "../build";
import { resolveTournament } from "../resolve";
import type { Match, TournamentBundle } from "../types";
import { getTournament, loadBundle, toRow } from "./data";
import { db } from "./db";

/** Enregistre un tournoi construit par lib/build.ts (en une transaction). */
export async function saveBuiltTournament(b: BuiltTournament): Promise<void> {
  await db().begin(async (sql) => {
    await sql`insert into tournaments ${sql(toRow(b.tournament))}`;
    if (b.pools.length) await sql`insert into pools ${sql(b.pools.map(toRow))}`;
    await sql`insert into courts ${sql(b.courts.map(toRow))}`;
    await sql`insert into court_codes ${sql(b.courtCodes.map(toRow))}`;
    await sql`insert into teams ${sql(b.teams.map(toRow))}`;
    for (let i = 0; i < b.matches.length; i += 500) await sql`insert into matches ${sql(b.matches.slice(i, i + 500).map(toRow))}`;
  });
  await applyResolution(b);
}

export async function updateMatch(id: string, patch: Partial<Match>): Promise<void> {
  const row = toRow(patch);
  const cols = Object.keys(row);
  if (!cols.length) return;
  const sql = db();
  await sql`update matches set ${sql(row, cols)} where id = ${id}`;
}

/** Recalcule forfaits, classements et tableau, puis écrit les différences en base. */
export async function applyResolution(bundle: TournamentBundle): Promise<number> {
  const { patches } = resolveTournament(bundle);
  for (const [id, patch] of patches) await updateMatch(id, patch);
  return patches.size;
}

export async function recompute(tournamentId: string): Promise<void> {
  const t = await getTournament({ id: tournamentId });
  if (!t) return;
  // Les matchs sont parcourus dans l'ordre du tableau : une passe suffit, la seconde confirme la stabilité.
  for (let i = 0; i < 2; i++) {
    const n = await applyResolution(await loadBundle(t));
    if (n === 0) break;
  }
}
