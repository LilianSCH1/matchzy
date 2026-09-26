// Répartition des équipes en poules.

export const POOL_MIN = 3;
export const POOL_MAX = 5;

export function poolName(index: number): string {
  // A…Z puis AA, AB…
  let s = "";
  let n = index;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/** Tailles de poules équilibrées (écart max 1) pour n équipes et k poules. */
export function poolSizes(teamCount: number, poolCount: number): number[] {
  const base = Math.floor(teamCount / poolCount);
  const extra = teamCount % poolCount;
  return Array.from({ length: poolCount }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Nombres de poules possibles pour que toutes les poules fassent entre 3 et 5 équipes. */
export function validPoolCounts(teamCount: number): number[] {
  const res: number[] = [];
  for (let k = 1; k <= Math.floor(teamCount / POOL_MIN); k++) {
    const sizes = poolSizes(teamCount, k);
    if (Math.min(...sizes) >= POOL_MIN && Math.max(...sizes) <= POOL_MAX) res.push(k);
  }
  return res;
}

/**
 * Propose un nombre de poules pour une taille cible (3, 4 ou 5).
 * Choisit le nombre valide dont la taille moyenne est la plus proche de la cible.
 */
export function suggestPoolCount(teamCount: number, targetSize = 4): number {
  const valid = validPoolCounts(teamCount);
  if (valid.length === 0) return Math.max(1, Math.round(teamCount / targetSize));
  let best = valid[0];
  let bestDist = Infinity;
  for (const k of valid) {
    const dist = Math.abs(teamCount / k - targetSize);
    // à égalité, on préfère plus de poules (matchs plus courts au total)
    if (dist < bestDist - 1e-9 || (Math.abs(dist - bestDist) < 1e-9 && k > best)) {
      best = k;
      bestDist = dist;
    }
  }
  return best;
}

function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Répartition aléatoire : renvoie pour chaque poule la liste des index d'équipes. */
export function distributeRandom(teamCount: number, poolCount: number, rand?: () => number): number[][] {
  const order = shuffle(
    Array.from({ length: teamCount }, (_, i) => i),
    rand,
  );
  return fillPools(order, poolSizes(teamCount, poolCount));
}

/**
 * Répartition par têtes de série, en serpentin : 1→A, 2→B, 3→C, 4→C, 5→B, 6→A…
 * `ranking` est la liste des index d'équipes du meilleur au moins bon.
 */
export function distributeSeeded(ranking: number[], poolCount: number): number[][] {
  const sizes = poolSizes(ranking.length, poolCount);
  const pools: number[][] = sizes.map(() => []);
  let i = 0;
  let row = 0;
  while (i < ranking.length) {
    const order = Array.from({ length: poolCount }, (_, p) => p);
    if (row % 2 === 1) order.reverse();
    for (const p of order) {
      if (i >= ranking.length) break;
      if (pools[p].length < sizes[p]) pools[p].push(ranking[i++]);
    }
    row++;
  }
  return pools;
}

function fillPools(order: number[], sizes: number[]): number[][] {
  const pools: number[][] = [];
  let k = 0;
  for (const size of sizes) {
    pools.push(order.slice(k, k + size));
    k += size;
  }
  return pools;
}

export { shuffle };
