import { describe, expect, it } from "vitest";
import type { TournamentInput } from "@/lib/build";
import { distributeSeeded, poolSizes, suggestPoolCount } from "@/lib/pools";
import { presetBySlug } from "@/lib/sports";
import { defaultQualifierOption, fitMatchDuration, parseTeams, placeholderTeams, previewEnd, qualifierOptions, recommendFormat } from "@/lib/wizard";

const foot = presetBySlug("football")!.rules;

describe("saisie des équipes", () => {
  it("découpe une liste collée, retire la numérotation et les doublons", () => {
    const r = parseTeams("1. Lions\n2) Tigres\n- Ours\n\nlions\nAigles", ["Aigles"]);
    expect(r.added).toEqual(["Lions", "Tigres", "Ours"]);
    expect(r.duplicates).toEqual(["lions", "Aigles"]);
  });

  it("accepte une ligne séparée par des virgules", () => {
    expect(parseTeams("A, B ; C", []).added).toEqual(["A", "B", "C"]);
  });

  it("ne dépasse pas 64 équipes", () => {
    const existing = Array.from({ length: 62 }, (_, i) => `T${i}`);
    const r = parseTeams("X\nY\nZ", existing);
    expect(r.added).toEqual(["X", "Y"]);
    expect(r.overflow).toBe(1);
  });

  it("génère des noms provisoires sans collision", () => {
    expect(placeholderTeams(3, ["Équipe 2"])).toEqual(["Équipe 1", "Équipe 3", "Équipe 4"]);
  });
});

describe("options de qualification", () => {
  it("ne propose que des combinaisons valides", () => {
    for (let n = 3; n <= 64; n++) {
      const sizes = poolSizes(n, suggestPoolCount(n, 4));
      const min = Math.min(...sizes);
      for (const o of qualifierOptions(sizes)) {
        expect(o.qualifiers).toBeLessThanOrEqual(min);
        expect(o.bestExtra).toBeLessThanOrEqual(sizes.filter((s) => s > o.qualifiers).length);
        expect(o.total).toBeGreaterThanOrEqual(2);
        expect(o.total).toBeLessThan(n);
      }
      expect(defaultQualifierOption(qualifierOptions(sizes))).not.toBeNull();
    }
  });

  it("privilégie un tableau complet", () => {
    // 3 poules de 4 : 2 premiers + 2 meilleurs 3es = quarts de finale complets
    const d = defaultQualifierOption(qualifierOptions([4, 4, 4]))!;
    expect(d).toMatchObject({ qualifiers: 2, bestExtra: 2, size: 8, byes: 0 });
    expect(d.detail).toContain("Quarts de finale");
  });

  it("conseille un championnat pour les petits effectifs", () => {
    expect(recommendFormat(4)).toBe("pools");
    expect(recommendFormat(12)).toBe("pools_knockout");
  });
});

describe("heure de fin", () => {
  const n = 12;
  const input: TournamentInput = {
    name: "Test",
    date: "2026-06-01",
    sportId: null,
    sportName: "Football",
    rules: foot,
    format: "pools_knockout",
    timezone: "UTC",
    startAt: "2026-06-01T09:00:00.000Z",
    matchDuration: 20,
    breakDuration: 5,
    minRest: 10,
    courts: 2,
    teams: Array.from({ length: n }, (_, i) => ({ name: `T${i}` })),
    pools: distributeSeeded(Array.from({ length: n }, (_, i) => i), 3),
    qualifiersPerPool: 2,
    bestExtra: 2,
    thirdPlace: true,
  };

  it("trouve la plus longue durée de match qui tient avant l'heure voulue", () => {
    const deadline = new Date("2026-06-01T15:00:00.000Z");
    const d = fitMatchDuration(input, deadline)!;
    expect(d).toBeGreaterThan(1);
    expect(previewEnd({ ...input, matchDuration: d })!.end.getTime()).toBeLessThanOrEqual(deadline.getTime());
    expect(previewEnd({ ...input, matchDuration: d + 1 })!.end.getTime()).toBeGreaterThan(deadline.getTime());
  });

  it("signale quand c'est impossible", () => {
    expect(fitMatchDuration(input, new Date("2026-06-01T09:30:00.000Z"))).toBeNull();
  });
});
