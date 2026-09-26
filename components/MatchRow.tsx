import Link from "next/link";
import { scoreText } from "@/lib/scoring";
import type { Match } from "@/lib/types";
import { fmtTime, type View } from "@/lib/view";
import { IconChevron } from "./Icons";

export function LiveBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`chip bg-live-soft text-live ${className}`}>
      <span className="live-dot inline-block size-1.5 rounded-full bg-live" /> En cours
    </span>
  );
}

export function StatusChip({ m, delay = 0 }: { m: Match; delay?: number }) {
  if (m.status === "live") return <LiveBadge />;
  if (m.status === "finished") return m.forfeit ? <span className="chip bg-warn-soft text-warn">Forfait</span> : null;
  if (delay > 0) return <span className="chip bg-warn-soft text-warn">+{delay} min</span>;
  return null;
}

export function MatchRow({
  m,
  v,
  href,
  showCourt = true,
  big = false,
}: {
  m: Match;
  v: View;
  href?: string;
  showCourt?: boolean;
  big?: boolean;
}) {
  const rules = v.b.tournament.rules;
  const done = m.status !== "scheduled";
  const w = m.winner_team_id;
  const extra = done && (m.sets?.length || m.shootout || m.forfeit) ? scoreText(m, rules).replace(/^\d+ - \d+ ?/, "") : "";
  const live = m.status === "live";

  const line = (id: string | null, name: string, score: number | null) => {
    const winner = !!w && w === id;
    const loser = !!w && !winner;
    return (
      <div className={`flex items-center justify-between gap-3 ${big ? "text-xl" : "text-[15px]"}`}>
        <span className={`truncate ${winner ? "font-semibold" : ""} ${loser ? "text-ink-2" : ""} ${!id ? "text-ink-3" : ""}`}>{name}</span>
        {done && (
          <span className={`font-semibold tabular-nums ${live ? "text-live" : loser ? "text-ink-3" : ""} ${big ? "text-2xl" : "text-base"}`}>{score}</span>
        )}
      </div>
    );
  };

  const body = (
    <div
      className={`card relative flex items-center gap-4 overflow-hidden transition ${big ? "p-5" : "px-4 py-3"} ${
        live ? "border-live/40" : ""
      } ${href ? "hover:border-line-strong active:scale-[0.995]" : ""}`}
    >
      {live && <span className="absolute inset-y-0 left-0 w-[3px] bg-live" />}
      <div className={`shrink-0 ${big ? "w-20" : "w-12"}`}>
        <div className={`font-medium tabular-nums ${big ? "text-xl" : "text-sm"}`}>{fmtTime(m.scheduled_at, v.tz)}</div>
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
    <Link href={href} className="block min-w-0">
      {body}
    </Link>
  ) : (
    body
  );
}
