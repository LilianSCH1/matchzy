// Types partagés entre la base, la logique métier et l'interface.

export type ScoreType = "goals" | "points" | "sets";

export type TiebreakCriterion =
  | "points" // points au classement
  | "head_to_head" // confrontation(s) directe(s) entre équipes à égalité
  | "diff" // différence de buts / points
  | "scored" // buts / points marqués
  | "set_diff" // différence de sets
  | "set_ratio" // quotient sets gagnés / perdus
  | "point_ratio" // quotient points marqués / encaissés (sports à sets)
  | "wins" // nombre de victoires
  | "fair_play"; // moins de points de pénalité fair-play

export type KnockoutTiebreak =
  | "none" // pas d'égalité possible (sets)
  | "penalties" // tirs au but directement
  | "extra_time" // prolongation jusqu'à la victoire (basket)
  | "extra_time_penalties" // prolongation puis tirs au but
  | "golden_point"; // point en or / set décisif

export interface SetRules {
  setsToWin: number; // 2 ou 3
  pointsPerSet: number; // 25, 21, 11…
  lastSetPoints: number; // 15 en volley, sinon = pointsPerSet
  winBy: number; // écart minimum (2)
  cap: number | null; // plafond (ex. 30 au badminton), null = pas de plafond
}

export interface SportRules {
  scoreType: ScoreType;
  allowDraw: boolean;
  /** Incréments proposés par les boutons + (ex. [1, 2, 3] au basket). */
  increments: number[];
  points: {
    win: number;
    draw: number;
    loss: number;
    forfeit: number; // points attribués à l'équipe forfait
    /** Barème à la volley : victoire/défaite serrée (au set décisif). */
    closeWin?: number;
    closeLoss?: number;
  };
  sets?: SetRules;
  knockoutTiebreak: KnockoutTiebreak;
  tiebreakers: TiebreakCriterion[];
  /** Score attribué au vainqueur / forfait (en sets : nombre de sets et points par set). */
  forfeitScore: { winner: number; loser: number };
  labels: {
    score: string; // but, point
    scorePlural: string;
    court: string; // terrain, court, table
    courtPlural: string;
    set: string;
    tiebreak: string; // « tirs au but », « prolongation »
  };
  defaults: { matchDuration: number; breakDuration: number };
}

export type Format = "pools" | "pools_knockout" | "knockout";
export type MatchStatus = "scheduled" | "live" | "finished";
export type Side = "home" | "away";

export type SlotSource =
  | { type: "team"; teamId: string }
  | { type: "pool"; poolId: string; rank: number }
  | { type: "best"; rank: number; index: number }
  | { type: "winner"; matchId: string }
  | { type: "loser"; matchId: string };

export interface SetScore {
  home: number;
  away: number;
}

export interface Sport {
  id: string;
  slug: string;
  name: string;
  rules: SportRules;
  is_preset: boolean;
}

export interface Tournament {
  id: string;
  slug: string;
  name: string;
  date: string;
  sport_id: string | null;
  sport_name: string;
  rules: SportRules;
  format: Format;
  timezone: string;
  start_at: string;
  match_duration: number;
  break_duration: number;
  min_rest: number;
  qualifiers_per_pool: number;
  best_extra: number;
  third_place: boolean;
  created_at?: string;
}

export interface Pool {
  id: string;
  tournament_id: string;
  name: string;
  position: number;
}

export interface Court {
  id: string;
  tournament_id: string;
  name: string;
  position: number;
}

export interface Team {
  id: string;
  tournament_id: string;
  pool_id: string | null;
  name: string;
  seed: number | null;
  draw_lot: number;
  withdrawn: boolean;
  fair_play: number;
}

export interface Match {
  id: string;
  tournament_id: string;
  phase: "pool" | "knockout";
  pool_id: string | null;
  round: number;
  bracket_round: number | null;
  bracket_slot: number | null;
  label: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_source: SlotSource | null;
  away_source: SlotSource | null;
  court_id: string | null;
  scheduled_at: string | null;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  sets: SetScore[] | null;
  shootout: SetScore | null;
  forfeit: Side | "both" | null;
  winner_team_id: string | null;
  is_bye: boolean;
  started_at: string | null;
  finished_at: string | null;
}

export interface TournamentBundle {
  tournament: Tournament;
  pools: Pool[];
  courts: Court[];
  teams: Team[];
  matches: Match[];
}
