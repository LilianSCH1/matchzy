// Jeu de données de démonstration : 14 équipes de foot et 10 équipes de volley,
// avec des résultats simulés selon l'heure actuelle (matchs terminés, en cours, à venir).
import { buildTournament, type TournamentInput } from "../build";
import { distributeSeeded, suggestPoolCount } from "../pools";
import { setsWon } from "../scoring";
import { presetBySlug } from "../sports";
import type { Match, SetScore, Sport, SportRules } from "../types";
import { saveBuiltTournament } from "./persist";
import { db } from "./db";

const FOOT_TEAMS = [
  "FC Rivière", "AS Collines", "US Port", "Olympique Plaine", "Racing Vallée", "Stade du Lac", "SC Forêt",
  "ES Montagne", "AJ Village", "Entente Nord", "FC Sud", "Union Est", "AS Ouest", "Juniors Centre",
];
const VOLLEY_TEAMS = [
  "Les Smasheurs", "Block Party", "Filet Mignon", "Les Passeurs", "Ace Ventura",
  "Côté Sable", "Service Gagnant", "Les Contres", "Réception Libre", "Manchette Club",
];

async function sportRules(slug: string): Promise<{ id: string | null; name: string; rules: SportRules }> {
  const [s] = await db()<Sport[]>`select * from sports where slug = ${slug}`;
  if (s) return { id: s.id, name: s.name, rules: s.rules };
  const p = presetBySlug(slug)!;
  return { id: null, name: p.name, rules: p.rules };
}

function todayIn(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Coup d'envoi : il y a 70 minutes, arrondi aux 5 minutes, pour avoir des matchs dans tous les états. */
function demoStart(): string {
  const d = new Date(Date.now() - 70 * 60000);
  d.setUTCSeconds(0, 0);
  d.setUTCMinutes(d.getUTCMinutes() - (d.getUTCMinutes() % 5));
  return d.toISOString();
}

const rnd = (n: number) => Math.floor(Math.random() * n);

function simulate(matches: Match[], duration: number, rules: SportRules) {
  const now = Date.now();
  for (const m of matches) {
    if (m.phase !== "pool" || !m.scheduled_at) continue;
    const start = new Date(m.scheduled_at).getTime();
    const end = start + duration * 60000;
    if (start > now) continue;
    const finished = end <= now;
    if (rules.scoreType === "sets") {
      const s = rules.sets!;
      const winner = rnd(2) === 0 ? "home" : "away";
      const three = rnd(3) === 0;
      const sets: SetScore[] = [];
      const plan = three ? [winner, winner === "home" ? "away" : "home", winner] : [winner, winner];
      plan.forEach((w, i) => {
        const target = i === 2 * s.setsToWin - 2 ? s.lastSetPoints : s.pointsPerSet;
        const lose = Math.max(0, target - 2 - rnd(10));
        sets.push(w === "home" ? { home: target, away: lose } : { home: lose, away: target });
      });
      const played = finished ? sets : sets.slice(0, 1).concat([{ home: rnd(15), away: rnd(15) }]);
      const w = setsWon(played, rules, false);
      Object.assign(m, { sets: played, home_score: w.home, away_score: w.away });
    } else {
      const goals = () => [0, 0, 1, 1, 1, 2, 2, 3, 4][rnd(9)];
      Object.assign(m, { home_score: goals(), away_score: goals() });
    }
    Object.assign(m, {
      status: finished ? "finished" : "live",
      started_at: m.scheduled_at,
      finished_at: finished ? new Date(end).toISOString() : null,
    });
  }
}

async function demoTournament(opts: {
  name: string;
  sport: string;
  teams: string[];
  courts: number;
  targetPoolSize: number;
  qualifiers: number;
  bestExtra: number;
  thirdPlace: boolean;
  duration?: number;
}) {
  const sport = await sportRules(opts.sport);
  const tz = "Europe/Paris";
  const k = suggestPoolCount(opts.teams.length, opts.targetPoolSize);
  const pools = distributeSeeded(
    opts.teams.map((_, i) => i),
    k,
  );
  const input: TournamentInput = {
    name: opts.name,
    date: todayIn(tz),
    sportId: sport.id,
    sportName: sport.name,
    rules: sport.rules,
    format: "pools_knockout",
    timezone: tz,
    startAt: demoStart(),
    matchDuration: opts.duration ?? sport.rules.defaults.matchDuration,
    breakDuration: sport.rules.defaults.breakDuration,
    minRest: 10,
    courts: opts.courts,
    teams: opts.teams.map((name, i) => ({ name, seed: i + 1 })),
    pools,
    qualifiersPerPool: opts.qualifiers,
    bestExtra: opts.bestExtra,
    thirdPlace: opts.thirdPlace,
  };
  const built = buildTournament(input, { slug: `demo-${opts.sport}-${Math.random().toString(36).slice(2, 6)}` });
  simulate(built.matches, input.matchDuration, sport.rules);
  await saveBuiltTournament(built);
  return built;
}

export async function createDemo() {
  const foot = await demoTournament({
    name: "Tournoi de foot (démo)",
    sport: "football",
    teams: FOOT_TEAMS,
    courts: 3,
    targetPoolSize: 4, // 4 poules : 4-4-3-3
    qualifiers: 2,
    bestExtra: 0,
    thirdPlace: true,
    duration: 12,
  });
  const volley = await demoTournament({
    name: "Tournoi de volley (démo)",
    sport: "volleyball",
    teams: VOLLEY_TEAMS,
    courts: 2,
    targetPoolSize: 5, // 2 poules de 5
    qualifiers: 2,
    bestExtra: 0,
    thirdPlace: true,
    duration: 20,
  });
  return [foot, volley];
}
