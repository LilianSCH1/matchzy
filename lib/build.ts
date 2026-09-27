// Construction complète d'un tournoi (poules, matchs, tableau, planning) à partir de la configuration.
import { buildBracket, type Seed } from "./bracket";
import { poolName } from "./pools";
import { bergerPairings } from "./roundrobin";
import { schedule, slotToDate, type SchedMatch, type ScheduleOptions } from "./schedule";
import type { Court, Format, Match, Pool, SportRules, Team, Tournament, TournamentBundle } from "./types";

export interface TournamentInput {
  name: string;
  date: string; // AAAA-MM-JJ
  sportId: string | null;
  sportName: string;
  rules: SportRules;
  format: Format;
  timezone: string;
  startAt: string; // ISO
  matchDuration: number;
  breakDuration: number;
  minRest: number;
  courts: number;
  teams: { name: string; seed?: number | null }[];
  /** Poules : index des équipes (formats avec poules). */
  pools: number[][];
  qualifiersPerPool: number;
  bestExtra: number;
  thirdPlace: boolean;
  /** Élimination directe seule : index des équipes de la meilleure tête de série à la moins bonne. */
  knockoutOrder?: number[];
}

export interface BuiltTournament extends TournamentBundle {
  courtCodes: { court_id: string; tournament_id: string; code: string }[];
}

// crypto.randomUUID n'existe qu'en contexte sécurisé (https / localhost) : repli pour un téléphone en http sur le réseau local.
const uuid = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function validateInput(i: TournamentInput): string | null {
  if (!i.name.trim()) return "Le nom du tournoi est obligatoire.";
  if (i.teams.length < 3 || i.teams.length > 64) return "Il faut entre 3 et 64 équipes.";
  const names = i.teams.map((t) => t.name.trim().toLowerCase());
  if (names.some((n) => !n)) return "Chaque équipe doit avoir un nom.";
  if (new Set(names).size !== names.length) return "Deux équipes portent le même nom.";
  if (i.courts < 1) return "Il faut au moins un terrain.";
  if (i.matchDuration < 1) return "Durée de match invalide.";
  if (i.format !== "knockout") {
    const used = i.pools.flat();
    if (used.length !== i.teams.length || new Set(used).size !== used.length)
      return "Chaque équipe doit être dans exactement une poule.";
    if (i.pools.some((p) => p.length < 2)) return "Chaque poule doit compter au moins 2 équipes.";
  }
  if (i.format === "pools_knockout") {
    const minSize = Math.min(...i.pools.map((p) => p.length));
    if (i.qualifiersPerPool < 1) return "Au moins un qualifié par poule.";
    if (i.qualifiersPerPool > minSize) return `Pas plus de ${minSize} qualifiés par poule (taille de la plus petite poule).`;
    const withExtra = i.pools.filter((p) => p.length > i.qualifiersPerPool).length;
    if (i.bestExtra > withExtra) return `Au plus ${withExtra} meilleur(s) ${i.qualifiersPerPool + 1}ᵉ(s).`;
    if (i.pools.length * i.qualifiersPerPool + i.bestExtra < 2) return "Il faut au moins 2 qualifiés.";
  }
  return null;
}

export function buildTournament(input: TournamentInput, opts: { id?: string; slug?: string; newId?: () => string } = {}): BuiltTournament {
  const newId = opts.newId ?? uuid;
  const tid = opts.id ?? newId();
  const tournament: Tournament = {
    id: tid,
    slug: opts.slug ?? `${slugify(input.name) || "tournoi"}-${Math.random().toString(36).slice(2, 6)}`,
    name: input.name.trim(),
    date: input.date,
    sport_id: input.sportId,
    sport_name: input.sportName,
    rules: input.rules,
    format: input.format,
    timezone: input.timezone,
    start_at: input.startAt,
    match_duration: input.matchDuration,
    break_duration: input.breakDuration,
    min_rest: input.minRest,
    qualifiers_per_pool: input.format === "pools_knockout" ? input.qualifiersPerPool : 0,
    best_extra: input.format === "pools_knockout" ? input.bestExtra : 0,
    third_place: input.format !== "pools" && input.thirdPlace,
  };

  const courts: Court[] = Array.from({ length: input.courts }, (_, i) => ({
    id: newId(),
    tournament_id: tid,
    name: `${capitalize(input.rules.labels.court)} ${i + 1}`,
    position: i,
  }));
  const codes = new Set<string>();
  const courtCodes = courts.map((c) => {
    let code: string;
    // 6 chiffres tirés au hasard cryptographique : impossibles à deviner avec la limite d'essais
    do code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
    while (codes.has(code));
    codes.add(code);
    return { court_id: c.id, tournament_id: tid, code };
  });

  const teams: Team[] = input.teams.map((t, i) => ({
    id: newId(),
    tournament_id: tid,
    pool_id: null,
    name: t.name.trim(),
    seed: t.seed ?? i + 1,
    draw_lot: Math.random(),
    withdrawn: false,
    fair_play: 0,
  }));

  const pools: Pool[] = [];
  const matches: Match[] = [];
  const base = (): Omit<Match, "id" | "phase"> => ({
    tournament_id: tid,
    pool_id: null,
    round: 0,
    bracket_round: null,
    bracket_slot: null,
    label: null,
    home_team_id: null,
    away_team_id: null,
    home_source: null,
    away_source: null,
    court_id: null,
    scheduled_at: null,
    status: "scheduled",
    home_score: null,
    away_score: null,
    sets: null,
    shootout: null,
    forfeit: null,
    winner_team_id: null,
    is_bye: false,
    started_at: null,
    finished_at: null,
  });

  const sched: SchedMatch[] = [];

  if (input.format !== "knockout") {
    input.pools.forEach((idxs, p) => {
      const pool: Pool = { id: newId(), tournament_id: tid, name: poolName(p), position: p };
      pools.push(pool);
      idxs.forEach((i) => (teams[i].pool_id = pool.id));
      bergerPairings(idxs.length).forEach((pr, k) => {
        const m: Match = {
          ...base(),
          id: newId(),
          phase: "pool",
          pool_id: pool.id,
          round: pr.round,
          label: `Poule ${pool.name}`,
          home_team_id: teams[idxs[pr.home]].id,
          away_team_id: teams[idxs[pr.away]].id,
        };
        matches.push(m);
        sched.push({ id: m.id, teams: [m.home_team_id!, m.away_team_id!], stage: 0, order: pr.round * 10000 + p * 100 + k });
      });
    });
  }

  if (input.format !== "pools") {
    let seeds: Seed[];
    if (input.format === "knockout") {
      const order = input.knockoutOrder ?? teams.map((_, i) => i);
      seeds = order.map((i) => ({ source: { type: "team", teamId: teams[i].id } }));
    } else {
      seeds = [];
      for (let r = 1; r <= input.qualifiersPerPool; r++)
        for (const p of pools) seeds.push({ source: { type: "pool", poolId: p.id, rank: r }, pool: p.id });
      for (let k = 1; k <= input.bestExtra; k++)
        seeds.push({ source: { type: "best", rank: input.qualifiersPerPool + 1, index: k } });
    }
    const bracket = buildBracket(seeds, tournament.third_place, newId);
    const rounds = Math.max(0, ...bracket.map((b) => b.bracket_round));
    for (const b of bracket) {
      const m: Match = {
        ...base(),
        id: b.id,
        phase: "knockout",
        round: b.bracket_round,
        bracket_round: b.bracket_round,
        bracket_slot: b.bracket_slot,
        label: b.label,
        home_source: b.home_source,
        away_source: b.away_source,
        is_bye: b.is_bye,
      };
      if (b.home_source?.type === "team") m.home_team_id = b.home_source.teamId;
      if (b.away_source?.type === "team") m.away_team_id = b.away_source.teamId;
      matches.push(m);
      if (!b.is_bye) {
        // La petite finale se joue juste avant la finale.
        const stage = 1 + (b.bracket_round === rounds ? (b.third_place ? rounds - 0.5 : rounds) : b.bracket_round);
        sched.push({ id: m.id, teams: [`${m.id}:h`, `${m.id}:a`], stage, order: b.bracket_slot });
      }
    }
  }

  const o: ScheduleOptions = {
    courts: input.courts,
    matchDuration: input.matchDuration,
    breakDuration: input.breakDuration,
    minRest: input.minRest,
  };
  const byId = new Map(matches.map((m) => [m.id, m]));
  for (const s of schedule(sched, o)) {
    const m = byId.get(s.id)!;
    m.court_id = courts[s.court].id;
    m.scheduled_at = slotToDate(input.startAt, s.slot, o).toISOString();
  }

  return { tournament, pools, courts, teams, matches, courtCodes };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Fin estimée (dernier match) d'un tournoi construit. */
export function estimatedEnd(b: TournamentBundle): Date | null {
  const times = b.matches.filter((m) => m.scheduled_at).map((m) => new Date(m.scheduled_at!).getTime());
  if (!times.length) return null;
  return new Date(Math.max(...times) + b.tournament.match_duration * 60000);
}
