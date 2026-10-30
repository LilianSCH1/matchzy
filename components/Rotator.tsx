"use client";

import { useEffect, useState } from "react";
import { fmtTime } from "@/lib/view";

const WIPE_MS = 750;

/**
 * Fait défiler des panneaux (écran géant), avec un volet de régie TV : le panneau sortant est effacé
 * pendant qu'une barre orange balaie l'écran et que le suivant apparaît. Une barre LED montre le temps
 * restant avant le panneau suivant (animation CSS : aucun rendu React pendant le décompte).
 */
export function Rotator({ panels, seconds = 15 }: { panels: { title: string; node: React.ReactNode }[]; seconds?: number }) {
  const [view, setView] = useState({ i: 0, prev: null as number | null });
  const count = Math.max(1, panels.length);
  const k = view.i % count;
  const go = (n: number) => setView((v) => (n % count === v.i % count ? v : { i: n % count, prev: v.i % count }));

  // Le décompte repart à chaque panneau (y compris après un choix manuel).
  useEffect(() => {
    if (panels.length < 2) return;
    const id = setTimeout(() => setView((v) => ({ i: (v.i + 1) % panels.length, prev: v.i % panels.length })), seconds * 1000);
    return () => clearTimeout(id);
  }, [k, panels.length, seconds]);

  // Le panneau sortant disparaît à la fin du volet.
  useEffect(() => {
    if (view.prev === null) return;
    const id = setTimeout(() => setView((v) => ({ ...v, prev: null })), WIPE_MS);
    return () => clearTimeout(id);
  }, [view.prev, view.i]);

  const current = panels[k];
  if (!current) return null;
  const leaving = view.prev !== null && view.prev !== k ? panels[view.prev] : null;
  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center gap-4">
        <h2 key={k} className={`display text-[40px] ${leaving ? "wipe-in" : ""}`}>
          {current.title}
        </h2>
        <div className="ml-auto flex items-center gap-1.5">
          {panels.map((p, n) => (
            <button
              key={p.title}
              onClick={() => go(n)}
              className={`relative h-2 overflow-hidden rounded-[2px] transition-[width] duration-500 ${n === k ? "w-10 bg-white/15" : "w-2 bg-line-strong"}`}
              aria-label={p.title}
              aria-current={n === k}
            >
              {n === k && panels.length > 1 && (
                <span
                  key={view.i}
                  className="fill-x absolute inset-0 bg-led shadow-[0_0_8px_rgb(255_176_0/0.7)]"
                  style={{ "--fill-duration": `${seconds}s` } as React.CSSProperties}
                />
              )}
              {n === k && panels.length < 2 && <span className="absolute inset-0 bg-led" />}
            </button>
          ))}
        </div>
      </div>
      <div className="relative grid min-h-0 flex-1 overflow-hidden [contain:layout_paint]">
        {leaving && (
          <div key={`out-${view.prev}`} aria-hidden className="wipe-out col-start-1 row-start-1 min-h-0 overflow-hidden">
            {leaving.node}
          </div>
        )}
        <div key={k} className={`col-start-1 row-start-1 min-h-0 overflow-hidden ${leaving ? "wipe-in" : "rise"}`}>
          {current.node}
        </div>
        {leaving && <span key={`sweep-${view.i}`} aria-hidden className="sweep pointer-events-none absolute inset-y-0 left-0 w-24 bg-accent/85 shadow-[0_0_40px_var(--glow)]" />}
      </div>
    </div>
  );
}

/**
 * Heure du tableau : les « 88:88 » éteints réservent la place (aucun décalage quand l'heure s'affiche).
 * `initial`, calculée par le serveur, s'affiche dès le premier rendu, sans attendre le JavaScript.
 */
export function Clock({ tz, initial = "" }: { tz: string; initial?: string }) {
  const [now, setNow] = useState<string>(initial);
  useEffect(() => {
    const tick = () => setNow(fmtTime(new Date().toISOString(), tz));
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [tz]);
  return (
    <span className="relative inline-block tabular-nums">
      <span aria-hidden className="text-[color:var(--led-off)] [text-shadow:none]">
        88:88
      </span>
      {/* La minute peut changer entre le rendu serveur et l'hydratation : l'écart est attendu. */}
      <span className="absolute inset-0" suppressHydrationWarning>
        {now}
      </span>
    </span>
  );
}
