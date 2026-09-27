// Évaluation d'un résultat de match selon les règles du sport.
import type { Match, SetScore, Side, SportRules } from "./types";

export type Outcome = Side | "draw" | "none";

type ScoreFields = Pick<Match, "home_score" | "away_score" | "sets" | "shootout" | "forfeit" | "phase">;

export function setTarget(index: number, rules: SportRules): number {
  const s = rules.sets;
  if (!s) return 0;
  const decisive = index === 2 * s.setsToWin - 2;
  return decisive ? s.lastSetPoints : s.pointsPerSet;
}

/** Vainqueur d'un set s'il est terminé selon les règles, sinon null. */
export function setWinner(set: SetScore, index: number, rules: SportRules): Side | null {
  const s = rules.sets;
  if (!s) return null;
  const target = setTarget(index, rules);
  const hi = Math.max(set.home, set.away);
  const lo = Math.min(set.home, set.away);
  if (set.home === set.away) return null;
  const capped = s.cap !== null && hi >= s.cap;
  if (hi >= target && (hi - lo >= s.winBy || capped)) return set.home > set.away ? "home" : "away";
  return null;
}

/** Sets gagnés par chaque équipe (un set compte dès qu'il est terminé selon les règles, ou à défaut au score). */
export function setsWon(sets: SetScore[] | null, rules: SportRules, lenient = true): SetScore {
  const r = { home: 0, away: 0 };
  (sets ?? []).forEach((set, i) => {
    const w = setWinner(set, i, rules) ?? (lenient && set.home !== set.away ? (set.home > set.away ? "home" : "away") : null);
    if (w) r[w]++;
  });
  return r;
}

export function outcome(m: ScoreFields, _rules: SportRules): Outcome {
  if (m.forfeit === "home") return "away";
  if (m.forfeit === "away") return "home";
  if (m.forfeit === "both") return "none";
  const h = m.home_score ?? 0;
  const a = m.away_score ?? 0;
  if (h > a) return "home";
  if (a > h) return "away";
  if (m.phase === "knockout" && m.shootout) {
    if (m.shootout.home > m.shootout.away) return "home";
    if (m.shootout.away > m.shootout.home) return "away";
  }
  return "draw";
}

/** Vérifie qu'un résultat peut être validé. Renvoie un message d'erreur ou null. */
export function validateResult(m: ScoreFields, rules: SportRules): string | null {
  if (m.forfeit) return null;
  if (rules.scoreType === "sets") {
    const s = rules.sets!;
    const unfinished = (m.sets ?? []).findIndex((set, i) => setWinner(set, i, rules) === null);
    if (unfinished >= 0) return `Le ${rules.labels.set} ${unfinished + 1} n'est pas terminé.`;
    const won = setsWon(m.sets, rules, false);
    if (Math.max(won.home, won.away) !== s.setsToWin)
      return `Le match se termine quand une équipe a gagné ${s.setsToWin} ${rules.labels.set}s.`;
    return null;
  }
  if (m.home_score === null || m.away_score === null) return "Score incomplet.";
  const o = outcome(m, rules);
  if (o === "draw") {
    if (m.phase === "pool" && !rules.allowDraw) return "Le match nul n'est pas autorisé dans ce sport.";
    if (m.phase === "knockout") {
      if (rules.knockoutTiebreak === "extra_time")
        return "Égalité : jouez la prolongation et saisissez le score final.";
      return `Égalité : saisissez le résultat des ${rules.labels.tiebreak}.`;
    }
  }
  return null;
}

/** Score par défaut d'un forfait. `side` = équipe forfait. */
export function forfeitScore(side: Side | "both", rules: SportRules): Pick<Match, "home_score" | "away_score" | "sets" | "shootout"> {
  const { winner, loser } = rules.forfeitScore;
  if (side === "both") return { home_score: 0, away_score: 0, sets: null, shootout: null };
  const homeWins = side === "away";
  if (rules.scoreType === "sets") {
    const n = rules.sets!.setsToWin;
    const sets = Array.from({ length: n }, () => (homeWins ? { home: winner, away: loser } : { home: loser, away: winner }));
    return { home_score: homeWins ? n : 0, away_score: homeWins ? 0 : n, sets, shootout: null };
  }
  return {
    home_score: homeWins ? winner : loser,
    away_score: homeWins ? loser : winner,
    sets: null,
    shootout: null,
  };
}

/** Points au classement gagnés par chaque équipe pour un match terminé. */
export function tablePoints(m: ScoreFields, rules: SportRules): SetScore {
  const p = rules.points;
  if (m.forfeit === "both") return { home: p.forfeit, away: p.forfeit };
  if (m.forfeit === "home") return { home: p.forfeit, away: p.win };
  if (m.forfeit === "away") return { home: p.win, away: p.forfeit };
  const o = outcome({ ...m, phase: "pool" }, rules);
  if (o === "draw") return { home: p.draw, away: p.draw };
  const winnerSide = o as Side;
  let win = p.win;
  let loss = p.loss;
  if (rules.scoreType === "sets" && p.closeWin !== undefined && p.closeLoss !== undefined) {
    const won = setsWon(m.sets, rules);
    const loserSets = winnerSide === "home" ? won.away : won.home;
    if (loserSets === rules.sets!.setsToWin - 1 && rules.sets!.setsToWin > 1) {
      win = p.closeWin;
      loss = p.closeLoss;
    }
  }
  return winnerSide === "home" ? { home: win, away: loss } : { home: loss, away: win };
}

/** Texte court d'un score : « 2 - 1 », « 2 - 0 (25-18, 25-20) », « 1 - 1 (4 - 3 tab) ». */
export function scoreText(m: ScoreFields & { status?: string }, rules: SportRules): string {
  if (m.home_score === null || m.away_score === null) return "–";
  let s = `${m.home_score} - ${m.away_score}`;
  if (rules.scoreType === "sets" && m.sets && m.sets.length) s += ` (${m.sets.map((x) => `${x.home}-${x.away}`).join(", ")})`;
  if (m.shootout && m.home_score === m.away_score) s += ` (${m.shootout.home}-${m.shootout.away} ${rules.knockoutTiebreak === "penalties" || rules.knockoutTiebreak === "extra_time_penalties" ? "t.a.b." : "dép."})`;
  if (m.forfeit) s += " forfait";
  return s;
}
