// Calcul des classements de poule avec critères de départage configurables.
import { setsWon, tablePoints } from "./scoring";
import type { Match, SportRules, Team, TiebreakCriterion } from "./types";

export interface StandingRow {
  teamId: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  forfeits: number;
  points: number;
  scored: number;
  conceded: number;
  diff: number;
  setsWon: number;
  setsLost: number;
  fairPlay: number;
  withdrawn: boolean;
  drawLot: number;
  rank: number;
  /** Vrai si l'équipe n'a pu être départagée que par tirage au sort. */
  byLot: boolean;
}

function emptyRow(t: Team): StandingRow {
  return {
    teamId: t.id,
    name: t.name,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    forfeits: 0,
    points: 0,
    scored: 0,
    conceded: 0,
    diff: 0,
    setsWon: 0,
    setsLost: 0,
    fairPlay: t.fair_play,
    withdrawn: t.withdrawn,
    drawLot: t.draw_lot,
    rank: 0,
    byLot: false,
  };
}

function accumulate(rows: Map<string, StandingRow>, matches: Match[], rules: SportRules) {
  for (const m of matches) {
    if (m.status !== "finished" || !m.home_team_id || !m.away_team_id) continue;
    const h = rows.get(m.home_team_id);
    const a = rows.get(m.away_team_id);
    if (!h || !a) continue;
    const pts = tablePoints(m, rules);
    h.played++;
    a.played++;
    h.points += pts.home;
    a.points += pts.away;
    let hs = m.home_score ?? 0;
    let as = m.away_score ?? 0;
    if (rules.scoreType === "sets") {
      const w = setsWon(m.sets, rules);
      h.setsWon += w.home;
      h.setsLost += w.away;
      a.setsWon += w.away;
      a.setsLost += w.home;
      hs = (m.sets ?? []).reduce((s, x) => s + x.home, 0);
      as = (m.sets ?? []).reduce((s, x) => s + x.away, 0);
      if (w.home > w.away) {
        h.won++;
        a.lost++;
      } else {
        a.won++;
        h.lost++;
      }
    } else if (m.forfeit === "home" || (!m.forfeit && hs < as)) {
      a.won++;
      h.lost++;
    } else if (m.forfeit === "away" || (!m.forfeit && hs > as)) {
      h.won++;
      a.lost++;
    } else if (m.forfeit === "both") {
      h.lost++;
      a.lost++;
    } else {
      h.drawn++;
      a.drawn++;
    }
    if (m.forfeit === "home" || m.forfeit === "both") h.forfeits++;
    if (m.forfeit === "away" || m.forfeit === "both") a.forfeits++;
    h.scored += hs;
    h.conceded += as;
    a.scored += as;
    a.conceded += hs;
  }
  for (const r of rows.values()) r.diff = r.scored - r.conceded;
}

function ratio(a: number, b: number): number {
  if (b === 0) return a === 0 ? 0 : Number.MAX_SAFE_INTEGER;
  return a / b;
}

function criterionKey(
  c: TiebreakCriterion,
  row: StandingRow,
  group: StandingRow[],
  matches: Match[],
  rules: SportRules,
  teams: Map<string, Team>,
): number {
  switch (c) {
    case "points":
      return row.points;
    case "wins":
      return row.won;
    case "diff":
      return row.diff;
    case "scored":
      return row.scored;
    case "set_diff":
      return row.setsWon - row.setsLost;
    case "set_ratio":
      return ratio(row.setsWon, row.setsLost);
    case "point_ratio":
      return ratio(row.scored, row.conceded);
    case "fair_play":
      return -row.fairPlay;
    case "head_to_head": {
      // Mini-classement entre les équipes à égalité : points puis différence.
      const ids = new Set(group.map((g) => g.teamId));
      const sub = matches.filter((m) => ids.has(m.home_team_id ?? "") && ids.has(m.away_team_id ?? ""));
      const mini = new Map<string, StandingRow>();
      for (const g of group) mini.set(g.teamId, emptyRow(teams.get(g.teamId)!));
      accumulate(mini, sub, rules);
      const r = mini.get(row.teamId)!;
      return r.points * 100000 + r.diff;
    }
  }
}

function rankGroup(
  group: StandingRow[],
  ci: number,
  criteria: TiebreakCriterion[],
  matches: Match[],
  rules: SportRules,
  teams: Map<string, Team>,
): StandingRow[] {
  if (group.length <= 1) return group;
  if (ci >= criteria.length) {
    // Tirage au sort (valeur aléatoire figée à la création de l'équipe)
    group.forEach((g) => (g.byLot = true));
    return [...group].sort((a, b) => b.drawLot - a.drawLot);
  }
  const keys = new Map(group.map((g) => [g.teamId, criterionKey(criteria[ci], g, group, matches, rules, teams)]));
  const sorted = [...group].sort((a, b) => keys.get(b.teamId)! - keys.get(a.teamId)!);
  const out: StandingRow[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && keys.get(sorted[j].teamId) === keys.get(sorted[i].teamId)) j++;
    const sub = sorted.slice(i, j);
    // Si le critère n'a rien départagé, on passe au suivant avec le même groupe.
    out.push(...rankGroup(sub, ci + 1, criteria, matches, rules, teams));
    i = j;
  }
  return out;
}

export function computeStandings(teams: Team[], matches: Match[], rules: SportRules): StandingRow[] {
  const rows = new Map(teams.map((t) => [t.id, emptyRow(t)]));
  const finished = matches.filter((m) => m.status === "finished");
  accumulate(rows, finished, rules);
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const criteria = rules.tiebreakers.length ? rules.tiebreakers : (["points"] as TiebreakCriterion[]);
  const all = [...rows.values()];
  // Les équipes ayant abandonné sont classées dernières.
  const active = rankGroup(all.filter((r) => !r.withdrawn), 0, criteria, finished, rules, teamMap);
  const out = [...active, ...rankGroup(all.filter((r) => r.withdrawn), 0, criteria, finished, rules, teamMap)];
  out.forEach((r, i) => (r.rank = i + 1));
  return out;
}

/**
 * Classement des équipes classées au rang `rank` dans chaque poule (« meilleurs 3ᵉˢ »).
 * Les poules pouvant être de tailles inégales, on compare des moyennes par match.
 */
export function rankNth(standingsByPool: StandingRow[][], rank: number): StandingRow[] {
  const rows = standingsByPool.map((s) => s[rank - 1]).filter((r): r is StandingRow => !!r && !r.withdrawn);
  const avg = (v: number, r: StandingRow) => (r.played ? v / r.played : 0);
  return rows.sort(
    (a, b) =>
      avg(b.points, b) - avg(a.points, a) ||
      avg(b.diff, b) - avg(a.diff, a) ||
      avg(b.scored, b) - avg(a.scored, a) ||
      a.fairPlay - b.fairPlay ||
      b.drawLot - a.drawLot,
  );
}
