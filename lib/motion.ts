import { useSyncExternalStore } from "react";

// Tokens de mouvement partagés : miroir des variables --ease-* et --dur-* de globals.css, au format de Motion.

export const ease = {
  outExpo: [0.16, 1, 0.3, 1],
  inOutQuint: [0.83, 0, 0.17, 1],
  snap: [0.3, 1.4, 0.5, 1],
} as const;

/** Durées en secondes (Motion) : retour immédiat, interface, scène, célébration. */
export const dur = { 1: 0.12, 2: 0.22, 3: 0.42, 4: 0.8 } as const;

export const spring = {
  /** Boutons, panneaux, éléments d'interface. */
  ui: { type: "spring", stiffness: 420, damping: 32 },
  /** Lignes de classement qui changent de place : plus ample, pour que l'œil suive. */
  standings: { type: "spring", stiffness: 180, damping: 22 },
} as const;

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** Préférence « réduire les animations » du système, suivie en direct. Faux côté serveur. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia(QUERY).matches;
}
