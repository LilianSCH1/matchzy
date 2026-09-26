"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { moveMatchAction } from "@/app/actions";
import { IconClock } from "./Icons";

/** Décale un match (et les suivants du même terrain) de N minutes. */
export function ShiftButton({ matchId, courtId, scheduledAt, minutes, label }: { matchId: string; courtId: string; scheduledAt: string; minutes: number; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-outline h-8 gap-1.5 px-3 text-[13px]"
      disabled={pending}
      title={`Repousser ce match et les suivants de ${minutes} min`}
      onClick={() =>
        start(async () => {
          const t = new Date(new Date(scheduledAt).getTime() + minutes * 60000).toISOString();
          const r = await moveMatchAction(matchId, t, courtId, true);
          if (!r.ok) alert(r.error);
          router.refresh();
        })
      }
    >
      <IconClock className="size-3.5" />
      {label ?? `${minutes > 0 ? "+" : ""}${minutes} min`}
    </button>
  );
}
