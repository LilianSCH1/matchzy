import { describe, expect, it } from "vitest";
import { buildTournament } from "@/lib/build";
import { cleanRules, safeNext, validateRules } from "@/lib/rules";
import { presetBySlug, SPORT_PRESETS } from "@/lib/sports";
import type { SportRules } from "@/lib/types";
import { input } from "./helpers";

const foot = presetBySlug("football")!.rules;
const volley = presetBySlug("volleyball")!.rules;

describe("validation des règles", () => {
  it("accepte tous les préréglages", () => {
    for (const p of SPORT_PRESETS) expect(validateRules(p.rules), p.slug).toBeNull();
  });

  it("refuse les règles incohérentes ou mal formées", () => {
    const bad: unknown[] = [
      null,
      "football",
      { ...foot, scoreType: "buts" },
      { ...foot, increments: [] },
      { ...foot, increments: [0] },
      { ...foot, points: { ...foot.points, win: 1.5 } },
      { ...foot, tiebreakers: ["points", "points"] },
      { ...foot, tiebreakers: ["taille"] },
      { ...foot, forfeitScore: { winner: 0, loser: 3 } },
      { ...foot, labels: { ...foot.labels, court: "" } },
      { ...foot, defaults: { matchDuration: 0, breakDuration: 0 } },
      { ...volley, sets: undefined },
      { ...volley, sets: { ...volley.sets!, setsToWin: 0 } },
      { ...volley, sets: { ...volley.sets!, cap: 10 } },
    ];
    for (const r of bad) expect(validateRules(r), JSON.stringify(r)).not.toBeNull();
  });

  it("ne conserve que les champs connus", () => {
    const dirty = { ...volley, extra: "<script>", labels: { ...volley.labels, hack: 1 } } as unknown as SportRules;
    const clean = cleanRules(dirty);
    expect(clean).not.toHaveProperty("extra");
    expect(clean.labels).not.toHaveProperty("hack");
    expect(clean).toEqual(cleanRules(volley));
    expect(validateRules(clean)).toBeNull();
  });
});

describe("redirection après connexion", () => {
  it("n'accepte que des chemins internes", () => {
    expect(safeNext("/t/tournoi/admin")).toBe("/t/tournoi/admin");
    expect(safeNext("/")).toBe("/");
    for (const s of ["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "", null, undefined, "/\tevil", 42]) expect(safeNext(s)).toBe("/");
  });
});

describe("codes arbitres", () => {
  it("6 chiffres, distincts par terrain", () => {
    const b = buildTournament({ ...input(14, "pools_knockout"), courts: 12 });
    const codes = b.courtCodes.map((c) => c.code);
    for (const c of codes) expect(c).toMatch(/^\d{6}$/);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
