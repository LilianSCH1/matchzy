// Validation des règles reçues du navigateur (Règles & accès, Sports & règles).
import type { KnockoutTiebreak, ScoreType, SportRules, TiebreakCriterion } from "./types";

const SCORE_TYPES: ScoreType[] = ["goals", "points", "sets"];
const KNOCKOUT_TIEBREAKS: KnockoutTiebreak[] = ["none", "penalties", "extra_time", "extra_time_penalties", "golden_point"];
const CRITERIA: TiebreakCriterion[] = ["points", "head_to_head", "diff", "scored", "set_diff", "set_ratio", "point_ratio", "wins", "fair_play"];
const LABELS = ["score", "scorePlural", "court", "courtPlural", "set", "tiebreak"] as const;

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isInt = (x: unknown, min: number, max: number) => Number.isInteger(x) && (x as number) >= min && (x as number) <= max;

/** Renvoie un message d'erreur si `r` n'est pas un objet SportRules cohérent, sinon null. */
export function validateRules(r: unknown): string | null {
  if (!isObj(r)) return "Règles invalides.";
  if (!SCORE_TYPES.includes(r.scoreType as ScoreType)) return "Type de score invalide.";
  if (typeof r.allowDraw !== "boolean") return "Option « match nul » invalide.";
  if (!Array.isArray(r.increments) || !r.increments.length || r.increments.length > 6 || !r.increments.every((n) => isInt(n, 1, 100)))
    return "Incréments invalides (1 à 6 valeurs entre 1 et 100).";

  const p = r.points;
  if (!isObj(p) || !(["win", "draw", "loss", "forfeit"] as const).every((k) => isInt(p[k], -100, 100))) return "Barème de points invalide.";
  if ((p.closeWin !== undefined && !isInt(p.closeWin, -100, 100)) || (p.closeLoss !== undefined && !isInt(p.closeLoss, -100, 100)))
    return "Barème au set décisif invalide.";

  if (r.scoreType === "sets") {
    const s = r.sets;
    if (!isObj(s)) return "Règles des sets manquantes.";
    if (!isInt(s.setsToWin, 1, 5)) return "Nombre de sets gagnants invalide (1 à 5).";
    if (!isInt(s.pointsPerSet, 1, 100) || !isInt(s.lastSetPoints, 1, 100)) return "Points par set invalides (1 à 100).";
    if (!isInt(s.winBy, 1, 10)) return "Écart minimum invalide (1 à 10).";
    if (s.cap !== null && (!isInt(s.cap, 1, 200) || (s.cap as number) < (s.pointsPerSet as number))) return "Plafond invalide (au moins le nombre de points par set).";
  }

  if (!KNOCKOUT_TIEBREAKS.includes(r.knockoutTiebreak as KnockoutTiebreak)) return "Départage en phase finale invalide.";
  if (!Array.isArray(r.tiebreakers) || !r.tiebreakers.every((c) => CRITERIA.includes(c)) || new Set(r.tiebreakers).size !== r.tiebreakers.length)
    return "Critères de départage invalides.";

  const f = r.forfeitScore;
  if (!isObj(f) || !isInt(f.winner, 0, 1000) || !isInt(f.loser, 0, 1000) || (f.winner as number) < (f.loser as number)) return "Score de forfait invalide.";

  const l = r.labels;
  if (!isObj(l) || !LABELS.every((k) => typeof l[k] === "string" && (l[k] as string).trim() && (l[k] as string).length <= 40)) return "Libellés invalides (1 à 40 caractères).";

  const d = r.defaults;
  if (!isObj(d) || !isInt(d.matchDuration, 1, 600) || !isInt(d.breakDuration, 0, 600)) return "Durées par défaut invalides.";
  return null;
}

/** Ne garde que les champs connus (évite de stocker des données arbitraires dans la colonne jsonb). */
export function cleanRules(r: SportRules): SportRules {
  const out: SportRules = {
    scoreType: r.scoreType,
    allowDraw: r.allowDraw,
    increments: [...r.increments],
    points: { win: r.points.win, draw: r.points.draw, loss: r.points.loss, forfeit: r.points.forfeit },
    knockoutTiebreak: r.knockoutTiebreak,
    tiebreakers: [...r.tiebreakers],
    forfeitScore: { winner: r.forfeitScore.winner, loser: r.forfeitScore.loser },
    labels: Object.fromEntries(LABELS.map((k) => [k, r.labels[k].trim()])) as SportRules["labels"],
    defaults: { matchDuration: r.defaults.matchDuration, breakDuration: r.defaults.breakDuration },
  };
  if (r.points.closeWin !== undefined) out.points.closeWin = r.points.closeWin;
  if (r.points.closeLoss !== undefined) out.points.closeLoss = r.points.closeLoss;
  if (r.sets) {
    const s = r.sets;
    out.sets = { setsToWin: s.setsToWin, pointsPerSet: s.pointsPerSet, lastSetPoints: s.lastSetPoints, winBy: s.winBy, cap: s.cap };
  }
  return out;
}

/** Destination de redirection sûre après connexion : chemin interne uniquement. */
export function safeNext(next: unknown): string {
  const s = typeof next === "string" ? next : "";
  // « //site » et « /\site » sont interprétés par les navigateurs comme des adresses externes.
  if (!s.startsWith("/") || s.startsWith("//") || s.startsWith("/\\") || /[\u0000-\u001f]/.test(s)) return "/";
  return s;
}
