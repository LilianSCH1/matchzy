// Direct par rafraîchissements successifs : ce qui a réellement changé entre deux rendus du serveur,
// et file des célébrations de l'écran géant. Sans état React : testable et utilisable partout.

export type Direction = "up" | "down";
export type Change = Direction | "changed";

/** Sens d'un changement de valeur : hausse ou baisse pour un nombre, simple changement sinon ; null si identique. */
export function changeOf<T>(prev: T, next: T): Change | null {
  if (Object.is(prev, next)) return null;
  if (typeof prev === "number" && typeof next === "number") return next > prev ? "up" : "down";
  return "changed";
}

/**
 * Équipes qui ont changé de place au classement (rang 1 = premier : passer de 3 à 2, c'est monter).
 * Une équipe absente du classement précédent ne bouge pas : elle vient d'apparaître.
 */
export function rankMoves(prev: ReadonlyMap<string, number> | null, next: Iterable<readonly [string, number]>): Map<string, Direction> {
  const moves = new Map<string, Direction>();
  if (!prev) return moves;
  for (const [id, rank] of next) {
    const before = prev.get(id);
    if (before !== undefined && before !== rank) moves.set(id, rank < before ? "up" : "down");
  }
  return moves;
}

export interface ScoreState {
  id: string;
  live: boolean;
  home: number | null;
  away: number | null;
}

export interface ScoreGain {
  matchId: string;
  side: "home" | "away";
}

/** Côtés dont le score a augmenté sur un match en cours (pas au premier affichage, ni sur une correction à la baisse). */
export function scoreGains(prev: ReadonlyMap<string, ScoreState> | null, next: readonly ScoreState[]): ScoreGain[] {
  if (!prev) return [];
  const gains: ScoreGain[] = [];
  for (const m of next) {
    const before = prev.get(m.id);
    if (!m.live || !before) continue;
    if ((m.home ?? 0) > (before.home ?? 0)) gains.push({ matchId: m.id, side: "home" });
    if ((m.away ?? 0) > (before.away ?? 0)) gains.push({ matchId: m.id, side: "away" });
  }
  return gains;
}

/**
 * File des célébrations : au plus une toutes les `gap` millisecondes par terrain, pour ne pas saturer l'écran
 * quand plusieurs scores arrivent dans le même rafraîchissement. Les suivantes attendent leur tour, dans l'ordre.
 */
export class CelebrationQueue<T> {
  private waiting = new Map<string, T[]>();
  private last = new Map<string, number>();

  constructor(private gap = 4000) {}

  push(key: string, item: T) {
    const list = this.waiting.get(key) ?? [];
    list.push(item);
    this.waiting.set(key, list);
  }

  /** Célébrations à montrer maintenant : la plus ancienne de chaque terrain libre. */
  take(now: number): T[] {
    const out: T[] = [];
    for (const [key, list] of this.waiting) {
      const last = this.last.get(key);
      if (last !== undefined && now - last < this.gap) continue;
      out.push(list.shift()!);
      this.last.set(key, now);
      if (!list.length) this.waiting.delete(key);
    }
    return out;
  }

  /** Délai avant la prochaine célébration possible (ms), ou null si la file est vide. */
  nextIn(now: number): number | null {
    let min: number | null = null;
    for (const key of this.waiting.keys()) {
      const last = this.last.get(key);
      const wait = last === undefined ? 0 : Math.max(0, this.gap - (now - last));
      min = min === null ? wait : Math.min(min, wait);
    }
    return min;
  }

  get size() {
    let n = 0;
    for (const list of this.waiting.values()) n += list.length;
    return n;
  }
}
