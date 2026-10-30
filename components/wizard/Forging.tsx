"use client";

import { useEffect, useState } from "react";
import { Led } from "../Stadium";

/**
 * Moment de génération, pendant que le serveur crée vraiment le tournoi : les chiffres du panneau roulent
 * jusqu'au nombre de matchs programmés et une barre se remplit en `hold` ms. Disparaît dès la navigation.
 */
export function Forging({ name, matches, courts, courtsLabel, hold }: { name: string; matches: number; courts: number; courtsLabel: string; hold: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setCount(matches), 60);
    return () => clearTimeout(t);
  }, [matches]);

  return (
    <div role="status" className="fixed inset-0 z-40 grid place-items-center bg-canvas/70 px-4 backdrop-blur-md">
      <div className="board rise w-full max-w-sm overflow-hidden rounded-[14px] p-6 text-center">
        <p className="font-cond text-xs font-extrabold tracking-[0.18em] text-[#f3efe4]/60 uppercase">Génération du planning</p>
        <p className="mt-1 truncate text-lg font-semibold">{name}</p>
        <Led value={count} digits={String(matches).length} className="mt-5 text-7xl" />
        <p className="mt-3 text-sm text-[#f3efe4]/70">
          matchs programmés sur {courts} {courtsLabel}
        </p>
        <span aria-hidden className="mt-5 block h-1 overflow-hidden rounded-full bg-white/10">
          <span className="fill-x block h-full bg-accent" style={{ "--fill-duration": `${hold}ms` } as React.CSSProperties} />
        </span>
      </div>
    </div>
  );
}
