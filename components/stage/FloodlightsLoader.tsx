"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Floodlights = dynamic(() => import("./Floodlights"), { ssr: false });

/** WebGL seulement sur un appareil qui peut se le permettre, sans « animations réduites » ni économie de données. */
function capable(): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  if (nav.connection?.saveData) return false;
  if ((nav.hardwareConcurrency ?? 0) < 4) return false;
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false;
  return typeof WebGL2RenderingContext !== "undefined";
}

/** Thème sombre effectif (choix explicite, ou système). */
function isDark(): boolean {
  return getComputedStyle(document.documentElement).colorScheme.includes("dark");
}

/**
 * Projecteurs WebGL montés une fois la page au repos (requestIdleCallback), par-dessus le décor CSS qui reste
 * le repli. `nightOnly` : seulement en thème sombre (le jour, le décor CSS suffit). Les props passent au canvas.
 */
export function FloodlightsLoader({ nightOnly = false, ...props }: { nightOnly?: boolean; intensity?: number; follow?: boolean; className?: string }) {
  const [ready, setReady] = useState(false);
  const [night, setNight] = useState(!nightOnly);

  useEffect(() => {
    if (!capable()) return;
    const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1));
    const cancel = window.cancelIdleCallback ?? clearTimeout;
    const id = idle(() => setReady(true), { timeout: 1500 });
    return () => cancel(id as number);
  }, []);

  useEffect(() => {
    if (!nightOnly) return;
    const sync = () => setNight(isDark());
    sync();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    window.addEventListener("matchzy:theme", sync);
    media.addEventListener("change", sync);
    return () => {
      window.removeEventListener("matchzy:theme", sync);
      media.removeEventListener("change", sync);
    };
  }, [nightOnly]);

  return ready && night ? <Floodlights {...props} /> : null;
}
