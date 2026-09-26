// Toutes rondes selon les tables de Berger (méthode du cercle).

export interface Pairing {
  round: number; // 1-based
  home: number; // index d'équipe
  away: number;
}

/**
 * Génère les rencontres d'une poule de n équipes.
 * Si n est impair, une équipe fictive est ajoutée : l'équipe qui la rencontre est exemptée pour la ronde.
 */
export function bergerPairings(n: number): Pairing[] {
  if (n < 2) return [];
  const size = n % 2 === 0 ? n : n + 1;
  const ghost = size - 1; // index fictif si n impair
  const hasGhost = size !== n;
  const rounds = size - 1;
  const half = size / 2;
  const res: Pairing[] = [];

  // Tableau tournant : la dernière position reste fixe.
  const rot = Array.from({ length: size }, (_, i) => i);
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      let a = rot[i];
      let b = rot[size - 1 - i];
      if (hasGhost && (a === ghost || b === ghost)) continue;
      // Alternance domicile / extérieur pour l'équipe fixe et le reste.
      if (i === 0 ? r % 2 === 1 : i % 2 === 1) [a, b] = [b, a];
      res.push({ round: r + 1, home: a, away: b });
    }
    // Rotation : on garde rot[size-1] fixe.
    const fixed = rot[size - 1];
    const moving = rot.slice(0, size - 1);
    moving.unshift(moving.pop()!);
    rot.splice(0, size, ...moving, fixed);
  }
  return res;
}

export function roundRobinMatchCount(n: number): number {
  return (n * (n - 1)) / 2;
}
