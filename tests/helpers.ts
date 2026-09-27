import type { TournamentInput } from "@/lib/build";
import { presetBySlug } from "@/lib/sports";

const foot = presetBySlug("football")!.rules;

/** Tournoi de foot de test : n équipes, 3 terrains. */
export function input(n: number, format: TournamentInput["format"]): TournamentInput {
  return {
    name: "Test",
    date: "2026-10-01",
    sportId: null,
    sportName: "Football",
    rules: foot,
    format,
    timezone: "Europe/Paris",
    startAt: "2026-10-01T08:00:00.000Z",
    matchDuration: 15,
    breakDuration: 5,
    minRest: 10,
    courts: 3,
    teams: Array.from({ length: n }, (_, i) => ({ name: `Équipe ${i + 1}` })),
    pools: n === 14 ? [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10], [11, 12, 13]] : [Array.from({ length: n }, (_, i) => i)],
    qualifiersPerPool: 2,
    bestExtra: 0,
    thirdPlace: true,
  };
}
