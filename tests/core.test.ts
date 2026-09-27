import { describe, expect, it } from "vitest";
import { buildBracket, seedOrder } from "@/lib/bracket";
import { buildTournament } from "@/lib/build";
import { distributeSeeded, poolSizes, suggestPoolCount, validPoolCounts } from "@/lib/pools";
import { resolveTournament } from "@/lib/resolve";
import { bergerPairings } from "@/lib/roundrobin";
import { forfeitScore, outcome, tablePoints, validateResult } from "@/lib/scoring";
import { presetBySlug } from "@/lib/sports";
import type { Match, SlotSource } from "@/lib/types";
import { input } from "./helpers";

const foot = presetBySlug("football")!.rules;
const volley = presetBySlug("volleyball")!.rules;

describe("poules", () => {
  it("propose des poules de 3 à 5 équipes", () => {
    for (let n = 3; n <= 64; n++) {
      const k = suggestPoolCount(n, 4);
      const sizes = poolSizes(n, k);
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(3);
      expect(Math.max(...sizes)).toBeLessThanOrEqual(5);
      expect(validPoolCounts(n)).toContain(k);
    }
    expect(suggestPoolCount(14, 4)).toBe(4); // 4-4-3-3 (moyenne 3,5) plutôt que 5-5-4 (4,67)
    expect(suggestPoolCount(14, 5)).toBe(3);
    expect(poolSizes(14, 4)).toEqual([4, 4, 3, 3]);
  });

  it("répartit les têtes de série en serpentin", () => {
    expect(distributeSeeded([0, 1, 2, 3, 4, 5, 6, 7], 4)).toEqual([
      [0, 7],
      [1, 6],
      [2, 5],
      [3, 4],
    ]);
  });
});

describe("Berger", () => {
  it.each([3, 4, 5, 6, 7])("chaque équipe rencontre toutes les autres une fois (n=%i)", (n) => {
    const p = bergerPairings(n);
    expect(p.length).toBe((n * (n - 1)) / 2);
    const keys = new Set(p.map((x) => [x.home, x.away].sort().join("-")));
    expect(keys.size).toBe(p.length);
    // Pas deux matchs pour une même équipe dans une ronde
    for (const r of new Set(p.map((x) => x.round))) {
      const teams = p.filter((x) => x.round === r).flatMap((x) => [x.home, x.away]);
      expect(new Set(teams).size).toBe(teams.length);
    }
  });
});

describe("tableau", () => {
  it("ordre des têtes de série", () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("exemptions pour 6 qualifiés", () => {
    let i = 0;
    const seeds = Array.from({ length: 6 }, (_, k) => ({ source: { type: "team", teamId: `t${k}` } as SlotSource }));
    const b = buildBracket(seeds, true, () => `m${i++}`);
    expect(b.filter((m) => m.bracket_round === 1)).toHaveLength(4);
    expect(b.filter((m) => m.is_bye)).toHaveLength(2);
    expect(b.find((m) => m.third_place)).toBeTruthy();
  });

  it("croise les poules au premier tour", () => {
    let i = 0;
    const pools = ["A", "B", "C"];
    const seeds = [1, 2].flatMap((r) => pools.map((p) => ({ source: { type: "pool", poolId: p, rank: r } as SlotSource, pool: p })));
    seeds.push({ source: { type: "best", rank: 3, index: 1 } as SlotSource, pool: undefined as unknown as string });
    seeds.push({ source: { type: "best", rank: 3, index: 2 } as SlotSource, pool: undefined as unknown as string });
    const b = buildBracket(seeds, false, () => `m${i++}`);
    for (const m of b.filter((x) => x.bracket_round === 1)) {
      const h = m.home_source as { poolId?: string };
      const a = m.away_source as { poolId?: string };
      if (h?.poolId && a?.poolId) expect(h.poolId).not.toBe(a.poolId);
    }
  });
});

describe("scores", () => {
  const m = (p: Partial<Match>) => ({ home_score: null, away_score: null, sets: null, shootout: null, forfeit: null, phase: "pool" as const, ...p });

  it("barème foot", () => {
    expect(tablePoints(m({ home_score: 2, away_score: 1 }), foot)).toEqual({ home: 3, away: 0 });
    expect(tablePoints(m({ home_score: 1, away_score: 1 }), foot)).toEqual({ home: 1, away: 1 });
  });

  it("barème volley selon les sets", () => {
    const close = m({ home_score: 2, away_score: 1, sets: [{ home: 25, away: 20 }, { home: 20, away: 25 }, { home: 15, away: 12 }] });
    expect(tablePoints(close, volley)).toEqual({ home: 2, away: 1 });
    const clear = m({ home_score: 0, away_score: 2, sets: [{ home: 20, away: 25 }, { home: 23, away: 25 }] });
    expect(tablePoints(clear, volley)).toEqual({ home: 0, away: 3 });
    expect(validateResult(close, volley)).toBeNull();
    expect(validateResult(m({ sets: [{ home: 25, away: 24 }, { home: 25, away: 20 }] }), volley)).not.toBeNull();
  });

  it("tirs au but en phase finale", () => {
    const ko = m({ phase: "knockout", home_score: 1, away_score: 1 });
    expect(validateResult(ko, foot)).not.toBeNull();
    expect(outcome({ ...ko, shootout: { home: 3, away: 4 } }, foot)).toBe("away");
  });

  it("forfait", () => {
    expect(forfeitScore("home", foot)).toMatchObject({ home_score: 0, away_score: 3 });
    expect(forfeitScore("away", volley).sets).toHaveLength(2);
  });
});

describe("tournoi complet", () => {
  it("planning sans conflit et phase finale remplie", () => {
    const b = buildTournament(input(14, "pools_knockout"));
    const pool = b.matches.filter((m) => m.phase === "pool");
    expect(pool).toHaveLength(6 + 6 + 3 + 3);
    // Aucune équipe deux fois sur un même créneau, aucun terrain double-réservé
    const byTime = new Map<string, Match[]>();
    for (const m of b.matches.filter((x) => x.scheduled_at)) byTime.set(m.scheduled_at!, [...(byTime.get(m.scheduled_at!) ?? []), m]);
    for (const list of byTime.values()) {
      const teams = list.flatMap((m) => [m.home_team_id, m.away_team_id]).filter(Boolean);
      expect(new Set(teams).size).toBe(teams.length);
      expect(new Set(list.map((m) => m.court_id)).size).toBe(list.length);
      expect(list.length).toBeLessThanOrEqual(3);
    }

    // On joue toutes les poules : l'équipe à domicile gagne 1-0
    for (const m of pool) Object.assign(m, { status: "finished", home_score: 1, away_score: 0 });
    let r = resolveTournament(b);
    expect(r.poolsComplete).toBe(true);
    for (const [id, p] of r.patches) Object.assign(b.matches.find((m) => m.id === id)!, p);
    const qf = b.matches.filter((m) => m.phase === "knockout" && m.bracket_round === 1);
    expect(qf).toHaveLength(4);
    qf.forEach((m) => expect(m.home_team_id && m.away_team_id).toBeTruthy());

    // Les quarts sont joués, les vainqueurs avancent
    for (const m of qf) Object.assign(m, { status: "finished", home_score: 2, away_score: 0 });
    r = resolveTournament(b);
    for (const [id, p] of r.patches) Object.assign(b.matches.find((m) => m.id === id)!, p);
    const semis = b.matches.filter((m) => m.bracket_round === 2);
    semis.forEach((m) => expect(qf.map((q) => q.home_team_id)).toContain(m.home_team_id));

    // Correction d'un quart : le vainqueur change, la demie dépendante est mise à jour
    Object.assign(semis[0], { status: "finished", home_score: 1, away_score: 0 });
    Object.assign(qf[0], { home_score: 0, away_score: 1 });
    r = resolveTournament(b);
    for (const [id, p] of r.patches) Object.assign(b.matches.find((m) => m.id === id)!, p);
    const dependent = b.matches.find((m) => m.bracket_round === 2 && (m.home_source as { matchId: string }).matchId === qf[0].id)!;
    expect(dependent.home_team_id).toBe(qf[0].away_team_id);
    expect(dependent.status).toBe("scheduled");
  });

  it("abandon : forfaits automatiques", () => {
    const b = buildTournament(input(5, "pools"));
    b.teams[0].withdrawn = true;
    const r = resolveTournament(b);
    const own = b.matches.filter((m) => m.home_team_id === b.teams[0].id || m.away_team_id === b.teams[0].id);
    own.forEach((m) => expect(r.patches.get(m.id)?.status).toBe("finished"));
    expect(r.standings.values().next().value!.at(-1)!.teamId).toBe(b.teams[0].id);
  });

  it("élimination directe seule avec 5 équipes", () => {
    const b = buildTournament(input(5, "knockout"));
    const r = resolveTournament(b);
    for (const [id, p] of r.patches) Object.assign(b.matches.find((m) => m.id === id)!, p);
    expect(b.matches.filter((m) => m.is_bye && m.status === "finished")).toHaveLength(3);
    const round2 = b.matches.filter((m) => m.bracket_round === 2 && !m.label?.startsWith("Petite"));
    expect(round2.flatMap((m) => [m.home_team_id, m.away_team_id]).filter(Boolean)).toHaveLength(3);
  });
});
