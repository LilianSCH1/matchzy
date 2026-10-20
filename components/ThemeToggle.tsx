"use client";

// Thème clair / sombre / système, mémorisé dans le navigateur (attribut data-theme sur <html>).
import { useEffect, useState } from "react";
import { IconMonitor, IconMoon, IconSun } from "./Icons";

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

/** Passe au thème suivant : système → clair → sombre → système. */
export function cycleTheme() {
  const order: ThemeChoice[] = ["system", "light", "dark"];
  applyTheme(order[(order.indexOf(readTheme()) + 1) % order.length]);
}

const META: Record<ThemeChoice, { label: string; Icon: (p: { className?: string }) => React.ReactNode }> = {
  system: { label: "Thème : système", Icon: IconMonitor },
  light: { label: "Thème : clair", Icon: IconSun },
  dark: { label: "Thème : sombre", Icon: IconMoon },
};

export function ThemeToggle({ withLabel = false, className = "" }: { withLabel?: boolean; className?: string }) {
  const [theme, setTheme] = useState<ThemeChoice>("system");
  useEffect(() => {
    const sync = () => setTheme(readTheme());
    sync();
    window.addEventListener("matchzy:theme", sync);
    return () => window.removeEventListener("matchzy:theme", sync);
  }, []);
  const { label, Icon } = META[theme];
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
