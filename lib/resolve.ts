// Recalcul de tout ce qui dépend des résultats : forfaits automatiques, classements,
// remplissage de la phase finale et avancement des vainqueurs dans le tableau.
import { forfeitScore, outcome } from "./scoring";
import { computeStandings, rankNth, type StandingRow } from "./standings";
import type { Match, SlotSource, TournamentBundle } from "./types";

export interface ResolveResult {
  patches: Map<string, Partial<Match>>;
  standings: Map<string, StandingRow[]>;
  poolsComplete: boolean;
  /** Classement des « meilleurs Nᵉˢ » par rang. */
  nth: Map<number, StandingRow[]>;
}

const RESET: Partial<Match> = {
  status: "scheduled",
  home_score: null,
  away_score: null,
  sets: null,
  shootout: null,
  forfeit: null,
  winner_team_id: null,
  started_at: null,
  finished_at: null,
};

export function resolveTournament(b: TournamentBundle, now = new Date()): ResolveResult {
  const rules = b.tournament.rules;
  const matches = new Map(b.matches.map((m) => [m.id, { ...m }]));
  const patches = new Map<string, Partial<Match>>();
  const withdrawn = new Set(b.teams.filter((t) => t.withdrawn).map((t) => t.id));

  const patch = (m: Match, p: Partial<Match>) => {
    const changed = (Object.keys(p) as (keyof Match)[]).some((k) => JSON.stringify(m[k]) !== JSON.stringify(p[k]));
    if (!changed) return;
    Object.assign(m, p);
    patches.set(m.id, { ...(patches.get(m.id) ?? {}), ...p });
  };

  const autoForfeit = (m: Match) => {
    if (m.status === "finished" || m.is_bye || !m.home_team_id || !m.away_team_id) return;
    const h = withdrawn.has(m.home_team_id);
    const a = withdrawn.has(m.away_team_id);
    if (!h && !a) return;
    const side = h && a ? "both" : h ? "home" : "away";
    patch(m, {
      ...forfeitScore(side, rules),
      forfeit: side,
      status: "finished",
      finished_at: now.toISOString(),
    });
  };

  const syncWinner = (m: Match) => {
    if (m.status !== "finished") {
      if (m.winner_team_id !== null) patch(m, { winner_team_id: null });
      return;
    }
    const o = outcome(m, rules);
    let w: string | null = null;
    if (o === "home") w = m.home_team_id;
    else if (o === "away") w = m.away_team_id;
    else if (o === "none" && m.phase === "knockout") w = null;
    if (m.winner_team_id !== w) patch(m, { winner_team_id: w });
  };

  // 1. Matchs de poule
  const poolMatches = [...matches.values()].filter((m) => m.phase === "pool");
  poolMatches.forEach((m) => {
    autoForfeit(m);
    syncWinner(m);
  });

  // 2. Classements
  const standings = new Map<string, StandingRow[]>();
  for (const p of [...b.pools].sort((x, y) => x.position - y.position)) {
    const teams = b.teams.filter((t) => t.pool_id === p.id);
    standings.set(p.id, computeStandings(teams, poolMatches.filter((m) => m.pool_id === p.id), rules));
  }
  const poolsComplete = poolMatches.length > 0 && poolMatches.every((m) => m.status === "finished");
  const nth = new Map<number, StandingRow[]>();
  const nthOf = (rank: number) => {
    if (!nth.has(rank)) nth.set(rank, rankNth([...standings.values()], rank));
    return nth.get(rank)!;
  };
  if (b.tournament.best_extra > 0) nthOf(b.tournament.qualifiers_per_pool + 1);

  // 3. Phase finale
  const resolveSource = (src: SlotSource | null): string | null | undefined => {
    if (!src) return null;
    switch (src.type) {
      case "team":
        return src.teamId;
      case "pool":
        return poolsComplete ? (standings.get(src.poolId)?.[src.rank - 1]?.teamId ?? null) : undefined;
      case "best":
        return poolsComplete ? (nthOf(src.rank)[src.index - 1]?.teamId ?? null) : undefined;
      case "winner":
      case "loser": {
        const prev = matches.get(src.matchId);
        if (!prev || prev.status !== "finished") return null;
        if (src.type === "winner") return prev.winner_team_id;
        if (prev.is_bye || !prev.winner_team_id) return null;
        return prev.winner_team_id === prev.home_team_id ? prev.away_team_id : prev.home_team_id;
      }
    }
  };

  const ko = [...matches.values()]
    .filter((m) => m.phase === "knockout")
    .sort((a, b) => (a.bracket_round ?? 0) - (b.bracket_round ?? 0) || (a.bracket_slot ?? 0) - (b.bracket_slot ?? 0));

  for (const m of ko) {
    let home = resolveSource(m.home_source);
    let away = resolveSource(m.away_source);
    const hasResult = m.status !== "scheduled";
    // Poules pas encore terminées (undefined) : on ne touche pas à un match déjà joué.
    if (home === undefined) home = hasResult ? m.home_team_id : null;
    if (away === undefined) away = hasResult ? m.away_team_id : null;
    if (home !== m.home_team_id || away !== m.away_team_id) {
      patch(m, { home_team_id: home, away_team_id: away, ...(hasResult && !m.is_bye ? RESET : {}) });
    }
    if (m.is_bye) {
      const p: Partial<Match> = home
        ? { status: "finished", winner_team_id: home }
        : { status: "scheduled", winner_team_id: null };
      patch(m, p);
      continue;
    }
    autoForfeit(m);
    syncWinner(m);
  }

  return { patches, standings, poolsComplete, nth };
}
