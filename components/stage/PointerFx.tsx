"use client";

import { useEffect } from "react";

const MAGNET_RADIUS = 80;
const MAGNET_PULL = 8;
const TILT_DEG = 4;

/**
 * Effets de pointeur de la page, par délégation (un seul écouteur, au plus un calcul par image) :
 * - `data-pointer` : position du pointeur dans l'élément (--mx, --my, en %), pour les remplissages qui en partent ;
 * - `data-tilt` : carte inclinée de ±4° vers le pointeur, reflet qui le suit (--mx, --my) ;
 * - `data-magnet` : bouton attiré de 8 px au plus par le pointeur qui passe à moins de 80 px.
 * Souris et pavé tactile seulement (pas au toucher), et rien si l'utilisateur réduit les animations.
 * Aucun état React : les styles sont écrits directement sur les éléments.
 */
export function PointerFx() {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let last: PointerEvent | null = null;
    let tilted: HTMLElement | null = null;
    const magnets = new Set<HTMLElement>();

    const frame = () => {
      raf = 0;
      const e = last;
      if (!e) return;
      const target = e.target instanceof Element ? e.target : null;

      const pointer = target?.closest<HTMLElement>("[data-pointer]");
      if (pointer) {
        const r = pointer.getBoundingClientRect();
        pointer.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
        pointer.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
      }

      const card = target?.closest<HTMLElement>("[data-tilt]") ?? null;
      if (tilted && tilted !== card) tilted.style.transform = "";
      tilted = card;
      if (card) {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        card.style.setProperty("--mx", `${x * 100}%`);
        card.style.setProperty("--my", `${y * 100}%`);
        card.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 2 * TILT_DEG}deg) rotateY(${(x - 0.5) * 2 * TILT_DEG}deg) translateY(-2px)`;
      }

      // Toutes les lectures, puis toutes les écritures : pas de recalcul de mise en page forcé.
      const pulls = [...magnets].map((el) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const reach = Math.max(r.width, r.height) / 2 + MAGNET_RADIUS;
        const d = Math.hypot(dx, dy);
        const k = d < reach ? (1 - d / reach) * MAGNET_PULL : 0;
        return [el, d ? (dx / d) * k : 0, d ? (dy / d) * k : 0] as const;
      });
      for (const [el, x, y] of pulls) el.style.translate = x || y ? `${x.toFixed(1)}px ${y.toFixed(1)}px` : "";
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      last = e;
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const onLeave = () => {
      if (tilted) tilted.style.transform = "";
      tilted = null;
      for (const el of magnets) el.style.translate = "";
    };

    for (const el of document.querySelectorAll<HTMLElement>("[data-magnet]")) magnets.add(el);
    document.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      onLeave();
    };
  }, []);
  return null;
}
