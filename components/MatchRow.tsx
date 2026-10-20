import Link from "next/link";
import { scoreText } from "@/lib/scoring";
import type { Match } from "@/lib/types";
import { fmtTime, type View } from "@/lib/view";
import { IconCheck, IconChevron } from "./Icons";

export function LiveBadge({ className = "", label = "En cours" }: { className?: string; label?: string }) {
  return (
    <span className={`chip bg-live-soft text-live ${className}`}>
      <span className="live-dot inline-block size-1.5 rounded-full bg-live" /> {label}
    </span>
  );
}

export function StatusChip({ m, delay = 0 }: { m: Match; delay?: number }) {
  if (m.status === "live") return <LiveBadge />;
  if (m.status === "finished") return m.forfeit ? <span className="chip bg-warn-soft text-warn">Forfait</span> : null;
  if (delay > 0) return <span className="chip bg-warn-soft text-warn tabular-nums">+{delay} min</span>;
  return null;
}

/** Détails du score au-delà du score principal : sets, tirs au but, forfait. */
function extraText(m: Match, v: View) {
  const done = m.status !== "scheduled";
  return done && (m.sets?.length || m.shootout || m.forfeit) ? scoreText(m, v.b.tournament.rules).replace(/^\d+ - \d+ ?/, "") : "";
}

export function MatchRow({
  m,
  v,
  href,
  showCourt = true,
  big = false,
  highlight,
}: {
  m: Match;
  v: View;
  href?: string;
  showCourt?: boolean;
  big?: boolean;
  /** Équipe à mettre en avant (équipe suivie, filtre du programme). */
  highlight?: string;
}) {
  const done = m.status !== "scheduled";
  const w = m.winner_team_id;
  const extra = extraText(m, v);
  const live = m.status === "live";

  const line = (id: string | null, name: string, score: number | null) => {
    const winner = !!w && w === id;
    const loser = !!w && !winner;
    const mine = !!highlight && highlight === id;
    return (
      <div className={`flex items-center justify-between gap-3 ${big ? "text-xl" : "text-[15px]"}`}>
        <span className={`flex min-w-0 items-center gap-1.5 ${winner ? "font-semibold" : ""} ${loser ? "text-ink-2" : ""} ${!id ? "text-ink-3 italic" : ""}`}>
          <span className={`truncate ${mine ? "rounded-md bg-accent-soft px-1.5 text-accent-ink" : ""}`}>{name}</span>
          {winner && <IconCheck className={`shrink-0 text-ok ${big ? "size-5" : "size-3.5"}`} />}
        </span>
        {done && (
          <span className={`font-semibold tabular-nums ${live ? "text-live" : loser ? "text-ink-3" : ""} ${big ? "text-3xl" : "text-base"}`}>{score}</span>
        )}
      </div>
    );
  };

  const body = (
    <div
      className={`card relative flex items-center gap-4 overflow-hidden transition ${big ? "p-5" : "px-4 py-3"} ${live ? "border-live/40" : ""} ${
        href ? "hover:border-line-strong hover:shadow-float active:scale-[0.995]" : ""
      }`}
    >
      {live && <span className="absolute inset-y-0 left-0 w-[3px] bg-live" />}
      <div className={`shrink-0 border-r border-line pr-3 ${big ? "w-28" : "w-[4.75rem]"}`}>
        <div className={`font-semibold tabular-nums ${big ? "text-xl" : "text-sm"} ${m.status === "finished" ? "text-ink-3" : ""}`}>{fmtTime(m.scheduled_at, v.tz)}</div>
        {showCourt && <div className={`truncate text-ink-3 ${big ? "text-sm" : "text-xs"}`}>{v.court(m)}</div>}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        {m.label && <div className="eyebrow truncate">{m.label}</div>}
        {line(m.home_team_id, v.home(m), m.home_score)}
        {line(m.away_team_id, v.away(m), m.away_score)}
        {extra && <div className="truncate text-xs text-ink-3">{extra}</div>}
      </div>
      <StatusChip m={m} delay={v.delay(m)} />
      {href && <IconChevron className="-mr-1 size-4 shrink-0 text-ink-3" />}
    </div>
  );
  return href ? (
    <Link href={href} className="block min-w-0 scroll-mt-32" id={`m-${m.id}`}>
      {body}
    </Link>
  ) : (
    <div className="min-w-0 scroll-mt-32" id={`m-${m.id}`}>
      {body}
    </div>
  );
}

/**
 * Tableau d'affichage d'un match : noms et scores en grand, état et chrono.
 * Utilisé pour les terrains en direct (public, organisation, arbitre, écran géant).
 */
export function Scoreboard({
  m,
  v,
  href,
  court,
  now = Date.now(),
  size = "md",
  cta,
}: {
  m: Match;
  v: View;
  href?: string;
  court?: string;
  now?: number;
  size?: "md" | "lg" | "xl";
  cta?: string;
}) {
  const live = m.status === "live";
  const done = m.status === "finished";
  const w = m.winner_team_id;
  const t = v.b.tournament;
  const elapsed = live && m.started_at && v.isMatchday(now) ? Math.max(0, Math.floor((now - new Date(m.started_at).getTime()) / 60000)) : null;
  const delay = v.delay(m, now);
  const startsIn = m.status === "scheduled" && m.scheduled_at ? Math.round((new Date(m.scheduled_at).getTime() - now) / 60000) : null;
  const extra = extraText(m, v);
  const name = { md: "text-base", lg: "text-xl", xl: "text-3xl" }[size];
  const score = { md: "text-3xl", lg: "text-4xl", xl: "text-6xl" }[size];
  const pad = { md: "p-4", lg: "p-5", xl: "p-6" }[size];

  const row = (id: string | null, label: string, s: number | null) => {
    const win = !!w && w === id;
    const lose = !!w && !win;
    return (
      <div className="flex items-center gap-3">
        <span className={`min-w-0 flex-1 truncate leading-tight font-semibold tracking-tight ${name} ${lose ? "text-ink-3" : ""} ${!id ? "font-medium text-ink-3 italic" : ""}`}>
          {label}
        </span>
        {win && <IconCheck className="size-5 shrink-0 text-ok" />}
        <span className={`min-w-[1.6ch] text-right leading-none font-semibold tracking-tight tabular-nums ${score} ${live ? "text-ink" : lose ? "text-ink-3" : ""}`}>
          {m.status === "scheduled" ? <span className="text-line-strong">–</span> : s}
        </span>
      </div>
    );
  };

  const body = (
    <div
      className={`card relative flex h-full flex-col gap-3 overflow-hidden ${pad} transition ${live ? "border-live/40 shadow-float" : ""} ${
        href ? "hover:border-line-strong hover:shadow-float active:scale-[0.995]" : ""
      }`}
    >
      {live && <span className="absolute inset-x-0 top-0 h-[3px] bg-live" />}
      <div className="flex items-center gap-2 text-xs text-ink-3">
        {court && <span className="font-semibold text-ink-2">{court}</span>}
        {court && m.label && <span aria-hidden>·</span>}
        {m.label && <span className="truncate">{m.label}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {live ? (
            <LiveBadge label={elapsed !== null ? `${elapsed}′` : "En cours"} className="tabular-nums" />
          ) : done ? (
            <span className="chip bg-surface-2 text-ink-2">{m.forfeit ? "Forfait" : "Terminé"}</span>
          ) : delay > 0 ? (
            <span className="chip bg-warn-soft text-warn tabular-nums">Retard {delay} min</span>
          ) : startsIn !== null && startsIn <= 60 && startsIn >= 0 ? (
            <span className="chip bg-accent-soft text-accent-ink tabular-nums">Dans {startsIn} min</span>
          ) : (
            <span className="chip bg-surface-2 text-ink-2 tabular-nums">{fmtTime(m.scheduled_at, t.timezone)}</span>
          )}
        </span>
      </div>
      <div className="space-y-2">
        {row(m.home_team_id, v.home(m), m.home_score)}
        {row(m.away_team_id, v.away(m), m.away_score)}
      </div>
      {(extra || cta || (live && elapsed !== null)) && (
        <div className="mt-auto flex items-center gap-3 pt-1">
          {live && elapsed !== null && (
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2" title={`${elapsed} / ${t.match_duration} min`}>
              <div className={`h-full rounded-full ${elapsed > t.match_duration ? "bg-warn" : "bg-live"}`} style={{ width: `${Math.min(100, (100 * elapsed) / t.match_duration)}%` }} />
            </div>
          )}
          {extra && <span className="min-w-0 flex-1 truncate text-xs text-ink-3">{extra}</span>}
          {cta && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-sm font-medium text-accent-ink">
              {cta} <IconChevron className="size-4" />
            </span>
          )}
        </div>
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full min-w-0">
      {body}
    </Link>
  ) : (
    body
  );
}
