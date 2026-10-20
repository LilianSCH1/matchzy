import { describe, expect, it } from "vitest";
import { buildTournament } from "@/lib/build";
import { homeCommands, normalize, searchCommands, tournamentCommands } from "@/lib/commands";
import { teamSummaries } from "@/lib/follow";
import { courtStatuses, forecast, tournamentInsights } from "@/lib/insights";
import { resolveTournament } from "@/lib/resolve";
import { byTime } from "@/lib/view";
import { input } from "./helpers";

const MIN = 60000;
const at = (iso: string, minutes: number) => new Date(iso).getTime() + minutes * MIN;

/** Tournoi de 8 équipes en poules + phase finale, 3 terrains, matchs de 15 min + 5 min de pause, début 08:00 UTC. */
function fresh() {
  const b = buildTournament({ ...input(8, "pools_knockout"), pools: [[0, 1, 2, 3], [4, 5, 6, 7]] });
  return b;
}

function firstOnCourt(b: ReturnType<typeof fresh>, courtId: string) {
  return b.matches.filter((m) => m.court_id === courtId && !m.is_bye).sort(byTime);
}

describe("assistant : terrains", () => {
  it("projette le retard du prochain match quand le match en cours déborde", () => {
    const b = fresh();
    const court = b.courts[0];
    const [first, second] = firstOnCourt(b, court.id);
    Object.assign(first, { status: "live", started_at: first.scheduled_at, home_score: 0, away_score: 0 });
    // 22 min après le début : le match de 15 min déborde de 7 min, le suivant (prévu à +20) partira au mieux à +27.
    const now = at(first.scheduled_at!, 22);
    const c = courtStatuses(b, now).find((x) => x.courtId === court.id)!;
    expect(c.live?.id).toBe(first.id);
    expect(c.next?.id).toBe(second.id);
    expect(c.delay).toBe(7);
    expect(c.state).toBe("late");
  });

  it("propose de décaler un terrain en retard, arrondi à 5 min", () => {
    const b = fresh();
    const court = b.courts[1];
    const [first] = firstOnCourt(b, court.id);
    const now = at(first.scheduled_at!, 12);
    const late = tournamentInsights(b, now).find((i) => i.id === `late-${court.id}`);
    expect(late?.shift).toMatchObject({ matchId: first.id, courtId: court.id, minutes: 15 });
    expect(late?.tone).toBe("warn");
  });

  it("signale un match en cours depuis trop longtemps (score oublié)", () => {
    const b = fresh();
    const [first] = firstOnCourt(b, b.courts[0].id);
    Object.assign(first, { status: "live", started_at: first.scheduled_at });
    const ins = tournamentInsights(b, at(first.scheduled_at!, 40));
    expect(ins[0]).toMatchObject({ id: `stale-${first.id}`, tone: "danger" });
  });

  it("détecte une équipe programmée deux fois en même temps", () => {
    const b = fresh();
    const team = b.teams[0].id;
    const [a, c] = b.matches.filter((m) => m.home_team_id === team || m.away_team_id === team).sort(byTime);
    c.scheduled_at = a.scheduled_at;
    const ins = tournamentInsights(b, at(b.tournament.start_at, -30));
    expect(ins.some((i) => i.tone === "danger" && i.title.includes(b.teams[0].name))).toBe(true);
  });

  it("annonce le coup d'envoi avant le début", () => {
    const b = fresh();
    const ins = tournamentInsights(b, at(b.tournament.start_at, -20));
    expect(ins.find((i) => i.id === "kickoff")?.title).toBe("Coup d'envoi dans 20 min");
  });

  it("prévoit la fin en ajoutant le retard projeté", () => {
    const b = fresh();
    const now = at(b.tournament.start_at, 10);
    const f = forecast(b, now);
    expect(f.total).toBe(b.matches.filter((m) => !m.is_bye).length);
    expect(f.maxDelay).toBe(10);
    expect(f.projectedEnd!.getTime()).toBeGreaterThan(f.plannedEnd!.getTime());
  });
});

describe("mon équipe", () => {
  it("donne le prochain match et la position en poule", () => {
    const b = fresh();
    const team = b.teams[0];
    const mine = b.matches.filter((m) => m.home_team_id === team.id || m.away_team_id === team.id).sort(byTime);
    const [m1] = mine;
    const home = m1.home_team_id === team.id;
    Object.assign(m1, { status: "finished", home_score: home ? 2 : 0, away_score: home ? 0 : 2, winner_team_id: team.id });
    const s = teamSummaries(b, resolveTournament(b))[team.id];
    expect(s.last?.result).toBe("W");
    expect(s.last?.us).toBe(2);
    expect(s.next?.id).toBe(mine[1].id);
    expect(s.rank).toBe(1);
    expect(s.qualifying).toBe(true);
    expect(s.headline).toMatch(/^1er de la poule/);
    expect(s.form).toEqual(["W"]);
  });
});

describe("palette de commandes", () => {
  it("cherche sans tenir compte des accents ni de la casse", () => {
    const b = fresh();
    const groups = tournamentCommands(b, { org: true });
    expect(normalize("Équipe")).toBe("equipe");
    const res = searchCommands(groups, "planning");
    expect(res[0].items[0].href).toBe(`/t/${b.tournament.slug}/admin/planning`);
    const teams = searchCommands(groups, "equipe 3");
    expect(teams.find((g) => g.id === "teams")?.items[0].label).toBe("Équipe 3");
  });

  it("n'expose les pages d'organisation qu'à l'organisateur", () => {
    const b = fresh();
    const pub = tournamentCommands(b, { org: false }).flatMap((g) => g.items);
    expect(pub.some((i) => i.href?.includes("/admin"))).toBe(false);
    expect(homeCommands([b.tournament], { org: false }).map((g) => g.id)).toEqual(["tournaments"]);
  });
});

describe("hors du jour du tournoi", () => {
  it("ne calcule ni retard ni chrono pour un tournoi passé resté ouvert", () => {
    const b = fresh();
    const [first] = firstOnCourt(b, b.courts[0].id);
    Object.assign(first, { status: "live", started_at: first.scheduled_at });
    const now = at(b.tournament.start_at, 3 * 24 * 60);
    expect(courtStatuses(b, now).every((c) => c.delay === 0 && c.elapsed === null)).toBe(true);
    const ins = tournamentInsights(b, now);
    expect(ins.some((i) => i.id.startsWith("late-") || i.id.startsWith("stale-"))).toBe(false);
    expect(ins[0].id).toBe("past-open");
  });
});
