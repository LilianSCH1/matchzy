import Link from "next/link";
import { scoreText } from "@/lib/scoring";
import type { Match } from "@/lib/types";
import { fmtTime, type View } from "@/lib/view";
import { IconCheck, IconChevron } from "./Icons";
import { Led } from "./Stadium";

export function LiveBadge({ className = "", label = "En cours" }: { className?: string; label?: string }) {
  return (
    <span className={`chip bg-live-solid text-white ${className}`}>
      <span className="live-dot inline-block size-1.5 rounded-full bg-white" /> {label}
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

/** Ligne de match : horaire et terrain à gauche, équipes et score à droite. */
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
  const stub = big ? "7rem" : "4.75rem";

  const line = (id: string | null, name: string, score: number | null) => {
    const winner = !!w && w === id;
    const loser = !!w && !winner;
    const mine = !!highlight && highlight === id;
    return (
      <div className={`flex items-center justify-between gap-3 ${big ? "text-xl" : "text-[16px]"}`}>
        <span className={`flex min-w-0 items-center gap-1.5 ${winner ? "font-bold" : "font-medium"} ${loser ? "text-ink-3" : ""} ${!id ? "text-ink-3 italic" : ""}`}>
          <span className={`truncate ${mine ? "rounded-[4px] bg-accent px-1.5 text-on-accent" : ""}`}>{name}</span>
          {winner && <IconCheck className={`shrink-0 text-ok ${big ? "size-5" : "size-4"}`} />}
        </span>
        {done && (
          <span className={` font-bold tabular-nums ${live ? "text-live" : loser ? "text-ink-3" : ""} ${big ? "text-3xl" : "text-[20px] leading-none"}`}>{score}</span>
        )}
      </div>
    );
  };

  const body = (
    <div
      className={`relative flex items-stretch overflow-hidden rounded-xl border bg-surface transition ${live ? "border-live/50" : "border-line"} ${
        href ? "hover:border-line-strong hover:bg-surface-2/50" : ""
      }`}
    >
      {live && <span className="absolute inset-y-0 left-0 w-1 bg-live" />}
      {/* Talon */}
      <div style={{ width: stub }} className={`flex shrink-0 flex-col justify-center border-r border-line ${big ? "px-5 py-4" : "px-3.5 py-3"}`}>
        <div className={`font-semibold tabular-nums ${big ? "text-[24px]" : "text-[17px]"} ${m.status === "finished" ? "text-ink-3" : ""}`}>{fmtTime(m.scheduled_at, v.tz)}</div>
        {showCourt && <div className={`mt-0.5 truncate text-ink-3 ${big ? "text-sm" : "text-[12px]"}`}>{v.court(m)}</div>}
      </div>
      <div className={`flex min-w-0 flex-1 items-center gap-3 ${big ? "px-5 py-4" : "py-2.5 pr-3.5 pl-4"}`}>
        <div className="min-w-0 flex-1 space-y-0.5">
          {m.label && <div className="truncate text-[12px] text-ink-3">{m.label}</div>}
          {line(m.home_team_id, v.home(m), m.home_score)}
          {line(m.away_team_id, v.away(m), m.away_score)}
          {extra && <div className="truncate text-xs text-ink-3">{extra}</div>}
        </div>
        <StatusChip m={m} delay={v.delay(m)} />
        {href && <IconChevron className="-mr-1 size-4 shrink-0 text-ink-3" />}
      </div>
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
 * Carte de score d'un match : noms des équipes, scores, état et chrono.
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
  const name = { md: "text-[17px]", lg: "text-[20px]", xl: "text-[30px]" }[size];
  const score = { md: "text-[30px]", lg: "text-[40px]", xl: "text-[72px]" }[size];
  const pad = { md: "p-3.5", lg: "p-4", xl: "p-6" }[size];
  const digits = Math.max(2, String(m.home_score ?? 0).length, String(m.away_score ?? 0).length);

  const row = (id: string | null, label: string, s: number | null, side: "home" | "away") => {
    const win = !!w && w === id;
    const lose = !!w && !win;
    return (
      <div className="flex items-center gap-3">
                <span
          className={`min-w-0 flex-1 truncate leading-tight font-bold ${name} ${lose ? "text-ink-3" : "text-ink"} ${!id ? "font-semibold text-ink-3 normal-case italic" : ""}`}
        >
          {label}
        </span>
        {win && <IconCheck className="size-5 shrink-0 text-ok" />}
        <span data-score={side} className={`min-w-[1.5ch] text-right ${lose ? "opacity-50" : ""}`}>
          <Led value={m.status === "scheduled" ? null : s} digits={digits} className={score} />
        </span>
      </div>
    );
  };

  const body = (
    <div
      className={`card relative flex h-full flex-col gap-3 overflow-hidden ${pad} transition ${live ? "border-live/50" : ""} ${href ? "hover:border-accent/60" : ""}`}
    >
      <div className="flex items-center gap-2 text-[13px] text-ink-3">
        {court && <span className="font-semibold text-ink-2">{court}</span>}
        {court && m.label && <span aria-hidden>·</span>}
        {m.label && <span className="truncate">{m.label}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {live ? (
            <span className="chip bg-live-solid text-white">
              <span className="live-dot size-1.5 rounded-full bg-white" />
              {elapsed !== null ? <span className="tabular-nums">{elapsed}′</span> : "Live"}
            </span>
          ) : done ? (
            <span className="chip bg-surface-2 text-ink-2">{m.forfeit ? "Forfait" : "Terminé"}</span>
          ) : delay > 0 ? (
            <span className="chip bg-warn-soft text-warn tabular-nums">Retard {delay} min</span>
          ) : startsIn !== null && startsIn <= 60 && startsIn >= 0 ? (
            <span className="chip bg-accent-soft text-accent-ink tabular-nums">Dans {startsIn} min</span>
          ) : (
            <span className="font-semibold text-ink-2 tabular-nums">{fmtTime(m.scheduled_at, t.timezone)}</span>
          )}
        </span>
      </div>
      <div className="space-y-2">
        {row(m.home_team_id, v.home(m), m.home_score, "home")}
        {row(m.away_team_id, v.away(m), m.away_score, "away")}
      </div>
      {(extra || cta || (live && elapsed !== null)) && (
        <div className="mt-auto flex items-center gap-3 pt-1">
          {live && elapsed !== null && (
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3" title={`${elapsed} / ${t.match_duration} min`}>
              <div className={`h-full rounded-full ${elapsed > t.match_duration ? "bg-warn" : "bg-live"}`} style={{ width: `${(100 * Math.min(elapsed, t.match_duration)) / t.match_duration}%` }} />
            </div>
          )}
          {extra && <span className="min-w-0 flex-1 truncate text-xs text-ink-2">{extra}</span>}
          {cta && (
            <span className="btn-accent ml-auto h-10 shrink-0 px-3.5 text-[15px]">
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
