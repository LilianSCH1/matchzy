import { useState } from "react";
import { changeOf, type Change } from "@/lib/live";

/**
 * Ce qui a changé depuis le rendu précédent pour un même identifiant (match, équipe…).
 * Le direct arrive par `router.refresh()` toutes les 5 s : seule une vraie différence déclenche une animation.
 * Rien au premier affichage, ni quand le composant est réutilisé pour un autre identifiant.
 * `n` augmente à chaque changement : il sert de `key` pour rejouer une animation CSS.
 */
export function useChanged<T>(id: string, value: T): { change: Change | null; n: number } {
  const [s, set] = useState({ id, value, change: null as Change | null, n: 0 });
  if (s.id !== id) {
    set({ id, value, change: null, n: s.n });
  } else if (!Object.is(s.value, value)) {
    set({ id, value, change: changeOf(s.value, value), n: s.n + 1 });
  }
  return { change: s.change, n: s.n };
}
