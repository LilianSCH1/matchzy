"use client";

import { useEffect } from "react";

const IDLE_MS = 3000;
const SHIFT_MS = 10 * 60 * 1000;

/**
 * Réglages d'un écran projeté toute la journée : l'écran ne se met pas en veille (Wake Lock, repris quand l'onglet
 * revient), le curseur disparaît après 3 s d'immobilité, double-clic pour le plein écran, et l'image se décale
 * d'un ou deux pixels toutes les 10 minutes pour éviter le marquage des dalles OLED et des projecteurs.
 * `target` : id de l'élément à décaler.
 */
export function Projection({ target }: { target: string }) {
  useEffect(() => {
    const root = document.documentElement;
    let lock: WakeLockSentinel | null = null;
    const keepAwake = async () => {
      if (document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {}
    };
    void keepAwake();
    document.addEventListener("visibilitychange", keepAwake);

    let idle: ReturnType<typeof setTimeout> | undefined;
    const wake = () => {
      root.classList.remove("cursor-idle");
      clearTimeout(idle);
      idle = setTimeout(() => root.classList.add("cursor-idle"), IDLE_MS);
    };
    wake();
    window.addEventListener("pointermove", wake, { passive: true });

    const fullscreen = () => {
      if (!document.fullscreenEnabled) return;
      if (document.fullscreenElement) void document.exitFullscreen();
      else void root.requestFullscreen().catch(() => {});
    };
    window.addEventListener("dblclick", fullscreen);

    const OFFSETS = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [-1, 1],
      [-1, 0],
      [-1, -1],
      [0, -1],
    ];
    let step = 0;
    const shift = setInterval(() => {
      const el = document.getElementById(target);
      step = (step + 1) % OFFSETS.length;
      el?.style.setProperty("translate", `${OFFSETS[step][0]}px ${OFFSETS[step][1]}px`);
    }, SHIFT_MS);

    return () => {
      document.removeEventListener("visibilitychange", keepAwake);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("dblclick", fullscreen);
      clearTimeout(idle);
      clearInterval(shift);
      root.classList.remove("cursor-idle");
      void lock?.release().catch(() => {});
    };
  }, [target]);
  return null;
}
