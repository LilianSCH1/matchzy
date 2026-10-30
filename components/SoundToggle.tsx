"use client";

import { useSyncExternalStore } from "react";
import { SOUND_EVENT, soundEnabled } from "@/lib/client/sound";
import { IconMute, IconSound } from "./Icons";

function subscribe(onChange: () => void) {
  window.addEventListener(SOUND_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SOUND_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useSoundEnabled() {
  return useSyncExternalStore(subscribe, soundEnabled, () => false);
}

/** Active ou coupe les sons de stade (coupés par défaut). Le moteur audio n'est chargé qu'au clic. */
export function SoundToggle({ className = "", label }: { className?: string; label?: string }) {
  const on = useSoundEnabled();
  const Icon = on ? IconSound : IconMute;
  const text = on ? "Couper le son" : "Activer le son";
  const toggle = () =>
    void import("@/lib/client/fx").then(({ setSound, fx }) => {
      setSound(!on);
      if (!on) fx.whistle();
    });
  return (
    <button type="button" onClick={toggle} className={label ? `btn-outline ${className}` : `btn-icon ${className}`} aria-label={text} aria-pressed={on} title={text}>
      <Icon className="size-[18px]" />
      {label && <span>{on ? "Son activé" : label}</span>}
    </button>
  );
}
