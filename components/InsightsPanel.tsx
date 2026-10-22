"use client";

// Assistant de l'organisateur : alertes classées par urgence, chacune avec l'action qui la règle.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { moveMatchAction } from "@/app/actions";
import type { Insight, InsightTone } from "@/lib/insights";
import { Spinner, toast } from "./feedback";
import { IconAlert, IconCheck, IconChevron, IconClock, IconInfo, IconSparkle, IconX } from "./Icons";

const TONE: Record<InsightTone, { box: string; icon: string; Icon: (p: { className?: string }) => React.ReactNode }> = {
  danger: { box: "border-danger/30", icon: "bg-danger-soft text-danger", Icon: IconAlert },
  warn: { box: "border-warn/30", icon: "bg-warn-soft text-warn", Icon: IconClock },
  info: { box: "", icon: "bg-accent-soft text-accent-ink", Icon: IconInfo },
  ok: { box: "", icon: "bg-ok-soft text-ok", Icon: IconCheck },
};

export function InsightsPanel({ insights }: { insights: Insight[] }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const list = insights.filter((i) => !hidden.includes(i.id));
  const urgent = list.filter((i) => i.tone === "danger" || i.tone === "warn").length;

  return (
    <section className="space-y-3" aria-label="Assistant">
      <div className="flex items-center gap-2">
        <span className="grid size-8 -rotate-6 place-items-center rounded-md bg-accent text-on-accent shadow-[inset_0_-3px_0_rgb(0_0_0/0.25)]">
          <IconSparkle className="size-4" />
        </span>
        <h2 className="display text-[26px]">Assistant</h2>
        <span className={`chip ml-auto h-5 px-2 text-[11px] ${urgent ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok"}`}>
          {urgent ? `${urgent} à traiter` : "Tout roule"}
        </span>
      </div>
      {list.length === 0 ? (
        <div className="card-quiet flex items-center gap-3 p-4 text-sm text-ink-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-ok-soft text-ok">
            <IconCheck className="size-4" />
          </span>
          Aucun retard, aucun conflit. L&apos;assistant vous préviendra dès qu&apos;un terrain prend du retard.
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((i) => (
            <InsightCard key={i.id} i={i} onHide={() => setHidden((h) => [...h, i.id])} />
          ))}
        </ul>
      )}
    </section>
  );
}

function InsightCard({ i, onHide }: { i: Insight; onHide: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { box, icon, Icon } = TONE[i.tone];
  const shift = () =>
    start(async () => {
      const s = i.shift!;
      const at = new Date(new Date(s.scheduledAt).getTime() + s.minutes * 60000).toISOString();
      const r = await moveMatchAction(s.matchId, at, s.courtId, true);
      if (!r.ok) toast(r.error, "error");
      else toast(`Planning décalé de ${s.minutes} min.`);
      router.refresh();
    });
  return (
    <li className={`card rise group relative flex gap-3 p-3.5 ${box}`}>
      <span className={`grid size-8 shrink-0 place-items-center rounded-md ${icon}`}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="pr-6 text-[15px] leading-snug font-semibold">{i.title}</div>
        {i.detail && <p className="text-[13px] leading-relaxed text-ink-2">{i.detail}</p>}
        {(i.shift || i.href) && (
          <div className="flex flex-wrap gap-2 pt-1.5">
            {i.shift && (
              <button className="btn-accent h-8 gap-1.5 rounded-md px-3 text-[13px]" onClick={shift} disabled={pending}>
                {pending ? <Spinner className="size-3.5" /> : <IconClock className="size-3.5" />}
                Décaler de {i.shift.minutes} min
              </button>
            )}
            {i.href && (
              <Link href={i.href} className="btn-outline h-8 gap-1 rounded-md px-3 text-[13px]">
                {i.cta ?? "Voir"} <IconChevron className="size-3.5" />
              </Link>
            )}
          </div>
        )}
      </div>
      <button
        onClick={onHide}
        className="absolute top-2.5 right-2.5 grid size-6 place-items-center rounded-md text-ink-3 opacity-0 transition group-hover:opacity-100 hover:bg-surface-2 hover:text-ink focus-visible:opacity-100"
        aria-label="Masquer"
        title="Masquer"
      >
        <IconX className="size-3.5" />
      </button>
    </li>
  );
}
