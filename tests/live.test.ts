import { describe, expect, it } from "vitest";
import { CelebrationQueue, changeOf, rankMoves, scoreGains, type ScoreState } from "@/lib/live";

describe("changeOf", () => {
  it("ne signale rien quand la valeur est identique", () => {
    expect(changeOf(2, 2)).toBeNull();
    expect(changeOf("live", "live")).toBeNull();
    expect(changeOf(null, null)).toBeNull();
  });
  it("donne le sens d'un changement numérique", () => {
    expect(changeOf(1, 2)).toBe("up");
    expect(changeOf(3, 1)).toBe("down");
  });
  it("signale un simple changement pour les autres valeurs", () => {
    expect(changeOf("scheduled", "live")).toBe("changed");
    expect(changeOf<number | null>(null, 0)).toBe("changed");
  });
});

describe("rankMoves", () => {
  it("rien au premier affichage", () => {
    expect(rankMoves(null, [["a", 1]]).size).toBe(0);
  });
  it("une équipe qui passe de 3 à 1 monte, celle qu'elle dépasse descend", () => {
    const prev = new Map([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
    const moves = rankMoves(prev, [
      ["c", 1],
      ["a", 2],
      ["b", 3],
    ]);
    expect(moves.get("c")).toBe("up");
    expect(moves.get("a")).toBe("down");
    expect(moves.get("b")).toBe("down");
  });
  it("une équipe qui apparaît ou ne bouge pas n'est pas signalée", () => {
    const moves = rankMoves(new Map([["a", 1]]), [
      ["a", 1],
      ["z", 2],
    ]);
    expect(moves.size).toBe(0);
  });
});

describe("scoreGains", () => {
  const s = (id: string, home: number | null, away: number | null, live = true): ScoreState => ({ id, live, home, away });
  const map = (...list: ScoreState[]) => new Map(list.map((m) => [m.id, m]));

  it("rien au premier affichage", () => {
    expect(scoreGains(null, [s("m1", 1, 0)])).toEqual([]);
  });
  it("détecte un but, et deux buts du même rafraîchissement", () => {
    expect(scoreGains(map(s("m1", 0, 0)), [s("m1", 1, 0)])).toEqual([{ matchId: "m1", side: "home" }]);
    expect(scoreGains(map(s("m1", 0, 0)), [s("m1", 1, 1)])).toEqual([
      { matchId: "m1", side: "home" },
      { matchId: "m1", side: "away" },
    ]);
  });
  it("ignore les corrections à la baisse, les matchs non en cours et les rafraîchissements sans changement", () => {
    expect(scoreGains(map(s("m1", 2, 0)), [s("m1", 1, 0)])).toEqual([]);
    expect(scoreGains(map(s("m1", 0, 0)), [s("m1", 1, 0, false)])).toEqual([]);
    expect(scoreGains(map(s("m1", 1, 0)), [s("m1", 1, 0)])).toEqual([]);
  });
  it("un match qui démarre (score null → 0) n'est pas un but", () => {
    expect(scoreGains(map(s("m1", null, null)), [s("m1", 0, 0)])).toEqual([]);
  });
});

describe("CelebrationQueue", () => {
  it("au plus une célébration toutes les 4 s par terrain, dans l'ordre", () => {
    const q = new CelebrationQueue<string>(4000);
    q.push("t1", "but 1");
    q.push("t1", "but 2");
    q.push("t2", "but A");
    expect(q.take(0)).toEqual(["but 1", "but A"]);
    expect(q.take(1000)).toEqual([]);
    expect(q.nextIn(1000)).toBe(3000);
    expect(q.take(4000)).toEqual(["but 2"]);
    expect(q.size).toBe(0);
    expect(q.nextIn(4000)).toBeNull();
  });
  it("un terrain libre célèbre tout de suite", () => {
    const q = new CelebrationQueue<string>(4000);
    q.push("t1", "x");
    expect(q.nextIn(0)).toBe(0);
  });
});
