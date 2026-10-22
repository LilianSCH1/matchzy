import { describe, expect, it } from "vitest";
import { ACCESS_CODE_LENGTH, isAccessCode, newAccessCode, normalizeAccessCode, parseTournamentRef } from "@/lib/access";
import { buildTournament } from "@/lib/build";
import { input } from "./helpers";

describe("codes participants", () => {
  it("tire des codes de 6 caractères lisibles, sans O/0 ni I/1/L", () => {
    const codes = Array.from({ length: 500 }, newAccessCode);
    for (const c of codes) {
      expect(c).toHaveLength(ACCESS_CODE_LENGTH);
      expect(c).toMatch(/^[A-HJKMNP-Z2-9]+$/);
      expect(isAccessCode(c)).toBe(true);
    }
    expect(new Set(codes).size).toBeGreaterThan(495);
  });

  it("accepte la saisie en minuscules avec espaces ou tirets", () => {
    expect(normalizeAccessCode(" ab2-c d9 ")).toBe("AB2CD9");
    expect(isAccessCode(normalizeAccessCode("ab2-cd9"))).toBe(true);
    expect(isAccessCode("ABC10O")).toBe(false);
    expect(isAccessCode("ABC")).toBe(false);
  });

  it("chaque tournoi construit reçoit un code", () => {
    const b = buildTournament(input(8, "pools"));
    expect(isAccessCode(b.accessCode)).toBe(true);
  });
});

describe("identifiant du tournoi saisi par le participant", () => {
  it("accepte le slug, le nom ou le lien partagé", () => {
    expect(parseTournamentRef("tournoi-volley-nancy")).toBe("tournoi-volley-nancy");
    expect(parseTournamentRef("  Tournoi Volley Nancy ")).toBe("tournoi-volley-nancy");
    expect(parseTournamentRef("https://matchzy.app/t/tournoi-volley-nancy?v=programme")).toBe("tournoi-volley-nancy");
    expect(parseTournamentRef("Tournoi de l'Été")).toBe("tournoi-de-l-ete");
  });
});
