import type { SportRules, TiebreakCriterion } from "./types";

export interface SportPreset {
  slug: string;
  name: string;
  rules: SportRules;
}

const goalLabels = {
  score: "but",
  scorePlural: "buts",
  court: "terrain",
  courtPlural: "terrains",
  set: "mi-temps",
  tiebreak: "tirs au but",
};

export const SPORT_PRESETS: SportPreset[] = [
  {
    slug: "football",
    name: "Football",
    rules: {
      scoreType: "goals",
      allowDraw: true,
      increments: [1],
      points: { win: 3, draw: 1, loss: 0, forfeit: 0 },
      knockoutTiebreak: "penalties",
      tiebreakers: ["points", "head_to_head", "diff", "scored", "fair_play"],
      forfeitScore: { winner: 3, loser: 0 },
      labels: goalLabels,
      defaults: { matchDuration: 15, breakDuration: 5 },
    },
  },
  {
    slug: "futsal",
    name: "Futsal",
    rules: {
      scoreType: "goals",
      allowDraw: true,
      increments: [1],
      points: { win: 3, draw: 1, loss: 0, forfeit: 0 },
      knockoutTiebreak: "penalties",
      tiebreakers: ["points", "head_to_head", "diff", "scored", "fair_play"],
      forfeitScore: { winner: 3, loser: 0 },
      labels: goalLabels,
      defaults: { matchDuration: 12, breakDuration: 3 },
    },
  },
  {
    slug: "handball",
    name: "Handball",
    rules: {
      scoreType: "goals",
      allowDraw: true,
      increments: [1],
      points: { win: 3, draw: 2, loss: 1, forfeit: 0 },
      knockoutTiebreak: "penalties",
      tiebreakers: ["points", "head_to_head", "diff", "scored", "fair_play"],
      forfeitScore: { winner: 10, loser: 0 },
      labels: { ...goalLabels, tiebreak: "jets de 7 m" },
      defaults: { matchDuration: 20, breakDuration: 5 },
    },
  },
  {
    slug: "basketball",
    name: "Basketball",
    rules: {
      scoreType: "points",
      allowDraw: false,
      increments: [1, 2, 3],
      points: { win: 2, draw: 0, loss: 1, forfeit: 0 },
      knockoutTiebreak: "extra_time",
      tiebreakers: ["points", "head_to_head", "diff", "scored"],
      forfeitScore: { winner: 20, loser: 0 },
      labels: {
        score: "point",
        scorePlural: "points",
        court: "terrain",
        courtPlural: "terrains",
        set: "quart-temps",
        tiebreak: "prolongation",
      },
      defaults: { matchDuration: 20, breakDuration: 5 },
    },
  },
  {
    slug: "volleyball",
    name: "Volleyball",
    rules: {
      scoreType: "sets",
      allowDraw: false,
      increments: [1],
      points: { win: 3, draw: 0, loss: 0, forfeit: 0, closeWin: 2, closeLoss: 1 },
      sets: { setsToWin: 2, pointsPerSet: 25, lastSetPoints: 15, winBy: 2, cap: null },
      knockoutTiebreak: "none",
      tiebreakers: ["points", "wins", "set_ratio", "point_ratio", "head_to_head"],
      forfeitScore: { winner: 25, loser: 0 },
      labels: {
        score: "point",
        scorePlural: "points",
        court: "terrain",
        courtPlural: "terrains",
        set: "set",
        tiebreak: "set décisif",
      },
      defaults: { matchDuration: 30, breakDuration: 5 },
    },
  },
  {
    slug: "badminton",
    name: "Badminton",
    rules: {
      scoreType: "sets",
      allowDraw: false,
      increments: [1],
      points: { win: 2, draw: 0, loss: 1, forfeit: 0 },
      sets: { setsToWin: 2, pointsPerSet: 21, lastSetPoints: 21, winBy: 2, cap: 30 },
      knockoutTiebreak: "none",
      tiebreakers: ["points", "head_to_head", "set_diff", "diff"],
      forfeitScore: { winner: 21, loser: 0 },
      labels: {
        score: "point",
        scorePlural: "points",
        court: "court",
        courtPlural: "courts",
        set: "set",
        tiebreak: "set décisif",
      },
      defaults: { matchDuration: 25, breakDuration: 5 },
    },
  },
  {
    slug: "tennis-de-table",
    name: "Tennis de table",
    rules: {
      scoreType: "sets",
      allowDraw: false,
      increments: [1],
      points: { win: 2, draw: 0, loss: 1, forfeit: 0 },
      sets: { setsToWin: 3, pointsPerSet: 11, lastSetPoints: 11, winBy: 2, cap: null },
      knockoutTiebreak: "none",
      tiebreakers: ["points", "head_to_head", "set_ratio", "point_ratio"],
      forfeitScore: { winner: 11, loser: 0 },
      labels: {
        score: "point",
        scorePlural: "points",
        court: "table",
        courtPlural: "tables",
        set: "manche",
        tiebreak: "manche décisive",
      },
      defaults: { matchDuration: 20, breakDuration: 5 },
    },
  },
  {
    slug: "rugby-7",
    name: "Rugby à 7",
    rules: {
      scoreType: "points",
      allowDraw: true,
      increments: [2, 3, 5, 7],
      points: { win: 3, draw: 2, loss: 1, forfeit: 0 },
      knockoutTiebreak: "extra_time",
      tiebreakers: ["points", "head_to_head", "diff", "scored", "fair_play"],
      forfeitScore: { winner: 28, loser: 0 },
      labels: {
        score: "point",
        scorePlural: "points",
        court: "terrain",
        courtPlural: "terrains",
        set: "mi-temps",
        tiebreak: "prolongation (point en or)",
      },
      defaults: { matchDuration: 14, breakDuration: 6 },
    },
  },
  {
    slug: "personnalise",
    name: "Personnalisé",
    rules: {
      scoreType: "goals",
      allowDraw: true,
      increments: [1],
      points: { win: 3, draw: 1, loss: 0, forfeit: 0 },
      knockoutTiebreak: "penalties",
      tiebreakers: ["points", "head_to_head", "diff", "scored"],
      forfeitScore: { winner: 3, loser: 0 },
      labels: goalLabels,
      defaults: { matchDuration: 15, breakDuration: 5 },
    },
  },
];

export const CRITERIA_LABELS: Record<TiebreakCriterion, string> = {
  points: "Points au classement",
  head_to_head: "Confrontation directe",
  diff: "Différence de buts / points",
  scored: "Buts / points marqués",
  set_diff: "Différence de sets",
  set_ratio: "Quotient de sets",
  point_ratio: "Quotient de points",
  wins: "Nombre de victoires",
  fair_play: "Fair-play (moins de pénalités)",
};

export const TIEBREAK_LABELS: Record<SportRules["knockoutTiebreak"], string> = {
  none: "Aucun (pas d'égalité possible)",
  penalties: "Tirs au but",
  extra_time: "Prolongation",
  extra_time_penalties: "Prolongation puis tirs au but",
  golden_point: "Point en or / set décisif",
};

export function presetBySlug(slug: string): SportPreset | undefined {
  return SPORT_PRESETS.find((p) => p.slug === slug);
}
