"use client";

import { useMemo } from "react";
import { buildTournament, validateInput, type TournamentInput } from "@/lib/build";
import { hhmm } from "./shared";

/**
 * Frise du planning réel, calculée comme l'aperçu : un couloir par terrain, un trait par match.
 * Quand on change le nombre de terrains ou la durée des matchs, chaque trait glisse vers sa nouvelle place.
 */
export function ScheduleFrieze({ input, courtsLabel }: { input: TournamentInput; courtsLabel: string }) {
  const key = JSON.stringify(input);
  const plan = useMemo(() => {
    if (validateInput(input)) return null;
    try {
      const b = buildTournament(input, { id: "preview", slug: "preview" });
      const lanes = new Map(b.courts.map((c, i) => [c.id, i]));
      const games = b.matches
        .filter((m) => !m.is_bye && m.scheduled_at && m.court_id)
        .map((m) => ({ at: new Date(m.scheduled_at!).getTime(), lane: lanes.get(m.court_id!) ?? 0, final: m.phase === "knockout" }));
      if (!games.length) return null;
      const start = Math.min(...games.map((g) => g.at));
      const end = Math.max(...games.map((g) => g.at)) + input.matchDuration * 60000;
      return { games, start, end, lanes: b.courts.length };
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!plan) return null;

  const span = plan.end - plan.start;
  const row = Math.max(4, Math.min(14, Math.floor(112 / plan.lanes)));
  const width = (input.matchDuration * 60000 * 100) / span;
  return (
    <figure className="card space-y-2 p-4" aria-label={`Planning : ${plan.games.length} matchs sur ${plan.lanes} ${courtsLabel}, de ${hhmm(new Date(plan.start))} à ${hhmm(new Date(plan.end))}`}>
      <div aria-hidden className="relative" style={{ height: plan.lanes * row }}>
        {plan.games.map((g, i) => (
          <span
            key={i}
            className={`absolute rounded-[2px] transition-[left,top,width] duration-(--dur-3) ease-(--ease-out-expo) motion-reduce:transition-none ${g.final ? "bg-accent" : "bg-ink/30"}`}
            style={{ left: `${((g.at - plan.start) * 100) / span}%`, width: `max(2px, calc(${width}% - 2px))`, top: g.lane * row, height: row - Math.max(1, row / 4) }}
          />
        ))}
      </div>
      <figcaption className="flex justify-between text-xs text-ink-3 tabular-nums">
        <span>{hhmm(new Date(plan.start))}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-[2px] bg-ink/30" /> Poules
          </span>
          {plan.games.some((g) => g.final) && (
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[2px] bg-accent" /> Phase finale
            </span>
          )}
        </span>
        <span>{hhmm(new Date(plan.end))}</span>
      </figcaption>
    </figure>
  );
}
