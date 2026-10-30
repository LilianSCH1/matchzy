"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** Au-delà, la transition se termine même si la page suivante tarde : l'écran ne reste jamais figé. */
const MAX_WAIT = 1500;

/**
 * Transitions entre pages (View Transitions API), sans option expérimentale de Next :
 * un clic sur un lien `data-vt` capture l'écran, navigue, puis attend la nouvelle page pour fondre de l'une à l'autre.
 * Les éléments qui portent le même `view-transition-name` des deux côtés (nom du tournoi, pastille du sport) se déplacent
 * de leur place à la nouvelle. Navigation normale si l'API manque, si un modificateur est enfoncé
 * ou si l'utilisateur réduit les animations.
 */
export function ViewTransitions() {
  const router = useRouter();
  const pathname = usePathname();
  const done = useRef<(() => void) | null>(null);

  // Nouvelle page affichée (effet exécuté après la mise à jour du DOM) : la transition peut jouer.
  useEffect(() => {
    done.current?.();
    done.current = null;
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[data-vt]") : null;
      if (!a || a.target === "_blank" || !("startViewTransition" in document)) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const url = new URL(a.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      e.preventDefault();
      document.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            done.current = resolve;
            setTimeout(resolve, MAX_WAIT);
            router.push(url.pathname + url.search + url.hash);
          }),
      );
    };
    // Phase de capture : avant le gestionnaire de clic de next/link.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return null;
}
