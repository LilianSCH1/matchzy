"use client";

import { useEffect, useState } from "react";

/** Fait défiler des panneaux (écran géant). */
export function Rotator({ panels, seconds = 15 }: { panels: { title: string; node: React.ReactNode }[]; seconds?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (panels.length < 2) return;
    const id = setInterval(() => setI((x) => (x + 1) % panels.length), seconds * 1000);
    return () => clearInterval(id);
  }, [panels.length, seconds]);
  const k = i % Math.max(1, panels.length);
  const current = panels[k];
  if (!current) return null;
  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">{current.title}</h2>
        <div className="ml-auto flex gap-1.5">
          {panels.map((p, n) => (
            <button
              key={p.title}
              onClick={() => setI(n)}
              className={`h-1.5 rounded-full transition-all duration-500 ${n === k ? "w-8 bg-accent" : "w-1.5 bg-line-strong"}`}
              aria-label={p.title}
            />
          ))}
        </div>
      </div>
      <div key={k} className="rise min-h-0 flex-1 overflow-hidden">
        {current.node}
      </div>
    </div>
  );
}

export function Clock({ tz }: { tz: string }) {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: tz }));
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [tz]);
  return <span className="tabular-nums">{now}</span>;
}
