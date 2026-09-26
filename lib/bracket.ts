// Génération du tableau à élimination directe.
import type { SlotSource } from "./types";

export interface Seed {
  source: SlotSource;
  /** Poule d'origine (pour éviter les rencontres entre équipes d'une même poule au 1er tour). */
  pool?: string;
}

export interface BracketMatch {
  id: string;
  bracket_round: number; // 1 = premier tour
  bracket_slot: number; // 0-based dans le tour ; petite finale : slot 1 du dernier tour
  label: string;
  home_source: SlotSource | null;
  away_source: SlotSource | null;
  is_bye: boolean;
  third_place: boolean;
}

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Ordre standard des têtes de série dans un tableau de taille P (1 contre P, 2 contre P-1…). */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

export function roundName(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  switch (fromEnd) {
    case 0:
      return "Finale";
    case 1:
      return "Demi-finale";
    case 2:
      return "Quart de finale";
    case 3:
      return "Huitième de finale";
    case 4:
      return "Seizième de finale";
    default:
      return `${2 ** fromEnd}ᵉ de finale`;
  }
}

function shortRoundName(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  return ["Finale", "Demie", "Quart", "8ᵉ", "16ᵉ", "32ᵉ"][fromEnd] ?? `${2 ** fromEnd}ᵉ`;
}

export function buildBracket(seeds: Seed[], thirdPlace: boolean, newId: () => string): BracketMatch[] {
  const q = seeds.length;
  if (q < 2) return [];
  const size = nextPow2(q);
  const rounds = Math.log2(size);
  const order = seedOrder(size);

  // Paires du premier tour (index de têtes de série 0-based, null = exempt)
  const pairs: [number | null, number | null][] = [];
  for (let i = 0; i < size; i += 2) {
    const a = order[i] - 1;
    const b = order[i + 1] - 1;
    pairs.push([a < q ? a : null, b < q ? b : null]);
  }
  avoidSamePool(pairs, seeds);

  const res: BracketMatch[] = [];
  const byRound: BracketMatch[][] = [];
  for (let r = 1; r <= rounds; r++) {
    const count = size / 2 ** r;
    const list: BracketMatch[] = [];
    for (let s = 0; s < count; s++) {
      let home: SlotSource | null;
      let away: SlotSource | null;
      let isBye = false;
      if (r === 1) {
        const [a, b] = pairs[s];
        home = a !== null ? seeds[a].source : null;
        away = b !== null ? seeds[b].source : null;
        if (home === null || away === null) {
          isBye = true;
          if (home === null) [home, away] = [away, null];
        }
      } else {
        home = { type: "winner", matchId: byRound[r - 2][2 * s].id };
        away = { type: "winner", matchId: byRound[r - 2][2 * s + 1].id };
      }
      const label = count > 1 ? `${shortRoundName(r, rounds)} ${s + 1}` : roundName(r, rounds);
      list.push({
        id: newId(),
        bracket_round: r,
        bracket_slot: s,
        label,
        home_source: home,
        away_source: away,
        is_bye: isBye,
        third_place: false,
      });
    }
    byRound.push(list);
    res.push(...list);
  }
  if (thirdPlace && rounds >= 2) {
    const semis = byRound[rounds - 2];
    res.push({
      id: newId(),
      bracket_round: rounds,
      bracket_slot: 1,
      label: "Petite finale",
      home_source: { type: "loser", matchId: semis[0].id },
      away_source: { type: "loser", matchId: semis[1].id },
      is_bye: false,
      third_place: true,
    });
  }
  return res;
}

/** Échange les adversaires du 1er tour pour éviter deux équipes d'une même poule. */
function avoidSamePool(pairs: [number | null, number | null][], seeds: Seed[]) {
  const pool = (i: number | null) => (i === null ? undefined : seeds[i].pool);
  const conflict = (p: [number | null, number | null]) => {
    const a = pool(p[0]);
    return a !== undefined && a === pool(p[1]);
  };
  for (let i = 0; i < pairs.length; i++) {
    if (!conflict(pairs[i])) continue;
    // On cherche un échange de l'adversaire, en priorité avec un adversaire de même rang.
    const candidates = pairs
      .map((_, j) => j)
      .filter((j) => j !== i && pairs[j][1] !== null)
      .sort((x, y) => Math.abs((pairs[x][1] ?? 0) - (pairs[i][1] ?? 0)) - Math.abs((pairs[y][1] ?? 0) - (pairs[i][1] ?? 0)));
    for (const j of candidates) {
      const a: [number | null, number | null] = [pairs[i][0], pairs[j][1]];
      const b: [number | null, number | null] = [pairs[j][0], pairs[i][1]];
      if (!conflict(a) && !conflict(b)) {
        pairs[i] = a;
        pairs[j] = b;
        break;
      }
    }
  }
}
