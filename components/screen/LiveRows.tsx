"use client";

import * as m from "motion/react-m";
import { useEffect, useState } from "react";
import { MotionIsland } from "@/components/motion/MotionIsland";
import { rankMoves, type Direction } from "@/lib/live";
import { spring } from "@/lib/motion";
import { RankCell } from "../RankCell";
import type { StandingsItem } from "../StandingsTable";

const MOVE_MS = 2000;

/**
 * Lignes du classement de l'écran géant : quand un rafraîchissement change l'ordre, chaque équipe glisse
 * jusqu'à sa nouvelle place (mise en page partagée de Motion), avec une flèche et un bref surlignage.
 */
export function LiveRows({ items }: { items: StandingsItem[] }) {
  const sig = items.map((r) => `${r.id}:${r.rank}`).join(",");
  const [s, set] = useState(() => ({ sig, ranks: new Map(items.map((r) => [r.id, r.rank])), moves: new Map<string, Direction>(), n: 0 }));
  if (s.sig !== sig) {
    const next = items.map((r) => [r.id, r.rank] as const);
    set({ sig, ranks: new Map(next), moves: rankMoves(s.ranks, next), n: s.n + 1 });
  }

  // Flèches et surlignage s'effacent après deux secondes.
  useEffect(() => {
    if (!s.moves.size) return;
    const id = setTimeout(() => set((x) => ({ ...x, moves: new Map() })), MOVE_MS);
    return () => clearTimeout(id);
  }, [s.n, s.moves.size]);

  return (
    <MotionIsland layout>
      <tbody className="divide-y divide-line">
        {items.map((r) => {
          const move = s.moves.get(r.id);
          return (
            <m.tr key={r.id} layout="position" transition={spring.standings} className={`${r.className} ${move ? `rank-${move}` : ""}`}>
              <RankCell rank={r.rank} qualified={r.qualified} big move={move} />
              {r.cells}
            </m.tr>
          );
        })}
      </tbody>
    </MotionIsland>
  );
}
