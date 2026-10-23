"use client";

// Thème clair / sombre, mémorisé dans le navigateur (attribut data-theme sur <html>).
import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "./Icons";

export type ThemeChoice = "light" | "dark" | "system";

const KEY = "matchzy:theme";

/** Script inline exécuté avant le rendu : applique le thème mémorisé sans flash. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export function readTheme(): ThemeChoice {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(t: ThemeChoice) {
  const root = document.documentElement;
  if (t === "system") delete root.dataset.theme;
  else root.dataset.theme = t;
  try {
    if (t === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {}
  window.dispatchEvent(new Event("matchzy:theme"));
}

/** Passe directement du thème clair au thème sombre, et inversement. */
export function cycleTheme() {
  const current = readTheme();
  if (current === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "light" : "dark");
  } else {
    applyTheme(current === "dark" ? "light" : "dark");
  }
}

export function ThemeToggle({ withLabel = false, className = "" }: { withLabel?: boolean; className?: string }) {
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [prefersDark, setPrefersDark] = useState(false);
  useEffect(() => {
    const sync = () => setTheme(readTheme());
    sync();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystem = () => setPrefersDark(media.matches);
    syncSystem();
    window.addEventListener("matchzy:theme", sync);
    media.addEventListener("change", syncSystem);
    return () => {
      window.removeEventListener("matchzy:theme", sync);
      media.removeEventListener("change", syncSystem);
    };
  }, []);
  const isDark = theme === "dark" || (theme === "system" && prefersDark);
  const Icon = isDark ? IconMoon : IconSun;
  const label = isDark ? "Passer au thème clair" : "Passer au thème sombre";
  return (
    <button
      type="button"
      onClick={cycleTheme}
      className={withLabel ? `btn-quiet h-9 w-full justify-start gap-2.5 px-2.5 text-sm ${className}` : `btn-icon ${className}`}
      aria-label={label}
      title={label}
    >
      <Icon className="size-[18px]" />
      {withLabel && <span>{label.replace("Thème : ", "Thème ")}</span>}
    </button>
  );
}
