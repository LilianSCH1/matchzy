// Terrains en direct (espace organisateur) : match en cours, suivants, retard projeté et actions rapides.
import Link from "next/link";
import type { CourtStatus } from "@/lib/insights";
import type { Match } from "@/lib/types";
import { fmtTime, type View } from "@/lib/view";
import { IconCheck, IconChevron, IconWhistle } from "./Icons";
import { LiveBadge } from "./MatchRow";
import { ShiftButton } from "./ShiftButton";

function StatePill({ c, now, tz }: { c: CourtStatus; now: number; tz: string }) {
  switch (c.state) {
    case "playing":
      return <LiveBadge label={c.elapsed !== null ? `En jeu · ${c.elapsed}′` : "En jeu"} className="tabular-nums" />;
    case "late":
      return (
        <span className="chip bg-warn-soft text-warn tabular-nums">
          {c.live && <span className="live-dot size-1.5 rounded-full bg-live" />}
          Retard {c.delay} min
        </span>
      );
    case "waiting": {
      const mins = c.next?.scheduled_at ? Math.round((new Date(c.next.scheduled_at).getTime() - now) / 60000) : null;
      return <span className="chip bg-accent-soft text-accent-ink tabular-nums">{mins !== null && mins > 0 ? `Dans ${mins} min` : "À lancer"}</span>;
    }
    case "idle":
      return <span className="chip bg-surface-2 text-ink-2">Libre jusqu&apos;à {fmtTime(c.next?.scheduled_at ?? null, tz)}</span>;
    case "done":
      return (
        <span className="chip bg-ok-soft text-ok">
          <IconCheck className="size-3" /> Terminé
        </span>
      );
  }
}

export function CourtBoard({ courts, v, base, now = Date.now() }: { courts: CourtStatus[]; v: View; base: string; now?: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
      {courts.map((c) => (
        <CourtCard key={c.courtId} c={c} v={v} base={base} now={now} />
      ))}
    </div>
  );
}

function CourtCard({ c, v, base, now }: { c: CourtStatus; v: View; base: string; now: number }) {
  const t = v.b.tournament;
  const focus = c.live ?? c.next;
  const pct = c.total ? (100 * c.played) / c.total : 0;
  const upcoming = (c.live ? [c.next, ...c.later] : c.later).filter(Boolean).slice(0, 2) as Match[];

  return (
    <article className={`card flex flex-col overflow-hidden ${c.state === "late" ? "border-warn/40" : c.live ? "border-live/30" : ""}`}>
      <header className="flex items-center gap-2 px-4 py-3">
        <h3 className="display text-[17px]">{c.name}</h3>
        <StatePill c={c} now={now} tz={t.timezone} />
        <span className="ml-auto text-[13px] text-ink-3 tabular-nums" title="Matchs joués sur ce terrain">
          {c.played}/{c.total} joués
        </span>
      </header>
      <div className="h-1 bg-surface-2">
        <div className="h-full bg-accent transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>

      {focus ? (
        <Link href={`${base}/match/${focus.id}`} className="group block px-4 pt-3 pb-3 transition hover:bg-surface-2/60">
          <div className="mb-1.5 flex items-center gap-2 text-xs text-ink-3">
            <span className="font-medium text-ink-2">{c.live ? "En cours" : "Prochain"}</span>
            <span aria-hidden>·</span>
            <span className="truncate">{focus.label}</span>
            <span className="ml-auto tabular-nums">{fmtTime(focus.scheduled_at, t.timezone)}</span>
          </div>
          {[
            [focus.home_team_id, v.home(focus), focus.home_score],
            [focus.away_team_id, v.away(focus), focus.away_score],
          ].map(([id, name, score], i) => (
            <div key={i} className="flex items-center gap-3">
              <span className={`min-w-0 flex-1 truncate text-[17px] leading-snug font-semibold ${!id ? "font-normal text-ink-3 italic" : ""}`}>{name}</span>
              <span className={`text-[24px] leading-tight font-bold tabular-nums ${c.live ? "" : "text-line-strong"}`}>{c.live ? score : "–"}</span>
            </div>
          ))}
          <div className="mt-2 flex items-center gap-1 text-[14px] font-semibold text-accent-ink">
            <IconWhistle className="size-3.5" />
            {c.live ? "Saisir le score" : "Démarrer ce match"}
            <IconChevron className="size-3.5 transition group-hover:translate-x-0.5" />
          </div>
        </Link>
      ) : (
        <div className="px-4 py-6 text-center text-sm text-ink-3">Tous les matchs de ce {t.rules.labels.court} sont joués.</div>
      )}

      {upcoming.length > 0 && (
        <ul className="divide-y divide-line border-t border-line text-[13px]">
          {upcoming.map((m) => (
            <li key={m.id}>
              <Link href={`${base}/match/${m.id}`} className="flex items-center gap-3 px-4 py-2 transition hover:bg-surface-2/60">
                <span className="w-10 shrink-0 font-medium text-ink-2 tabular-nums">{fmtTime(m.scheduled_at, t.timezone)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {v.home(m)} <span className="text-ink-3">–</span> {v.away(m)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {c.next?.scheduled_at && (
        <footer className="mt-auto flex items-center justify-between gap-2 border-t border-line px-4 py-2">
          <span className="text-xs text-ink-3">{c.delay > 0 ? `Le prochain partira vers ${fmtTime(new Date(new Date(c.next.scheduled_at).getTime() + c.delay * 60000).toISOString(), t.timezone)}` : "À l'heure"}</span>
          <ShiftButton matchId={c.next.id} courtId={c.courtId} scheduledAt={c.next.scheduled_at} minutes={5} />
        </footer>
      )}
    </article>
  );
}
