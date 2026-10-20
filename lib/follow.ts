// Résumé par équipe pour « Mon équipe » (vue publique) : position, prochain match, dernier résultat.
import { roundName } from "./bracket";
import type { ResolveResult } from "./resolve";
import type { TournamentBundle } from "./types";
import { byTime, ordinal, View } from "./view";

export interface TeamMatchBrief {
  id: string;
  label: string;
  opponent: string;
  at: string | null;
  court: string;
  live: boolean;
  /** Score de l'équipe suivie d'abord. */
  us: number | null;
  them: number | null;
  result: "W" | "D" | "L" | null;
}

export interface TeamSummary {
  id: string;
  name: string;
  pool: string | null;
  rank: number | null;
  poolSize: number;
  points: number;
  played: number;
  /** Dans la zone de qualification de sa poule (poules + phase finale). */
  qualifying: boolean;
  withdrawn: boolean;
  /** Phrase d'état : « 2e de la poule A », « En demi-finale », « Éliminée en quart »… */
  headline: string;
  next: TeamMatchBrief | null;
  last: TeamMatchBrief | null;
  remaining: number;
  form: ("W" | "D" | "L")[];
}

export function teamSummaries(b: TournamentBundle, r: ResolveResult): Record<string, TeamSummary> {
  const v = new View(b);
  const t = b.tournament;
  const q = t.format === "pools_knockout" ? t.qualifiers_per_pool : 0;
  const ko = b.matches.filter((m) => m.phase === "knockout" && !m.is_bye);
  const rounds = ko.length ? Math.max(...ko.map((m) => m.bracket_round ?? 0)) : 0;
  const out: Record<string, TeamSummary> = {};

  for (const team of b.teams) {
    const mine = v
      .playable()
      .filter((m) => m.home_team_id === team.id || m.away_team_id === team.id)
      .sort(byTime);
    const brief = (m: (typeof mine)[number]): TeamMatchBrief => {
      const home = m.home_team_id === team.id;
      const us = home ? m.home_score : m.away_score;
      const them = home ? m.away_score : m.home_score;
      const result = m.status !== "finished" ? null : m.winner_team_id === team.id ? "W" : m.winner_team_id ? "L" : "D";
      return {
        id: m.id,
        label: m.label ?? "",
        opponent: home ? v.away(m) : v.home(m),
        at: m.scheduled_at,
        court: v.court(m),
        live: m.status === "live",
        us: m.status === "scheduled" ? null : us,
        them: m.status === "scheduled" ? null : them,
        result,
      };
    };
    const finished = mine.filter((m) => m.status === "finished");
    const upcoming = mine.filter((m) => m.status !== "finished");
    const rows = team.pool_id ? (r.standings.get(team.pool_id) ?? []) : [];
    const row = rows.find((x) => x.teamId === team.id);
    const poolName = team.pool_id ? (v.pools.get(team.pool_id) ?? null) : null;

    // État dans la phase finale : dernier match de tableau joué ou à jouer.
    const koMine = mine.filter((m) => m.phase === "knockout");
    let headline = row && poolName ? `${ordinal(row.rank)} de la poule ${poolName}` : "";
    if (team.withdrawn) headline = "Abandon";
    else if (koMine.length) {
      const current = koMine.find((m) => m.status !== "finished");
      const lastKo = [...koMine].reverse().find((m) => m.status === "finished");
      const name = (m: (typeof koMine)[number]) =>
        m.bracket_round === rounds && m.bracket_slot === 1 ? "petite finale" : roundName(m.bracket_round ?? 1, rounds).toLowerCase();
      if (current) headline = `Qualifiée · ${name(current)}`;
      else if (lastKo) {
        const won = lastKo.winner_team_id === team.id;
        const isFinal = lastKo.bracket_round === rounds && (lastKo.bracket_slot ?? 0) === 0;
        const isThird = lastKo.bracket_round === rounds && lastKo.bracket_slot === 1;
        headline = isFinal ? (won ? "Vainqueur du tournoi" : "Finaliste") : isThird ? (won ? "3e place" : "4e place") : `Éliminée en ${name(lastKo)}`;
      }
    } else if (t.format === "pools_knockout" && r.poolsComplete && row) {
      headline = `${ordinal(row.rank)} de la poule ${poolName} · éliminée`;
    }

    out[team.id] = {
      id: team.id,
      name: team.name,
      pool: poolName,
      rank: row?.rank ?? null,
      poolSize: rows.length,
      points: row?.points ?? 0,
      played: row?.played ?? finished.length,
      qualifying: !!row && q > 0 && row.rank <= q && !team.withdrawn,
      withdrawn: team.withdrawn,
      headline: headline || `${finished.length} match${finished.length > 1 ? "s" : ""} joué${finished.length > 1 ? "s" : ""}`,
      next: upcoming[0] ? brief(upcoming[0]) : null,
      last: finished.length ? brief(finished[finished.length - 1]) : null,
      remaining: upcoming.length,
      form: finished.slice(-5).map((m) => brief(m).result!),
    };
  }
  return out;
}
