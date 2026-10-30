import Link from "next/link";
import { fmtDate } from "@/lib/view";
import { IconArrowRight } from "./Icons";
import { SportBadge, sportKey } from "./Stadium";

/**
 * Carte de tournoi : sport, état, nom, date et avancement. Toute la carte mène à `href`
 * (page du tournoi par défaut). Utilisée par la liste de l'organisateur et par « Mes tournois » des participants.
 */
export function TournamentCard({
  slug,
  name,
  sport,
  date,
  subtitle,
  live = 0,
  done = 0,
  total = 0,
  featured,
  muted,
  href,
  footer,
}: {
  slug: string;
  name: string;
  sport: string;
  date: string;
  subtitle?: string;
  live?: number;
  done?: number;
  total?: number;
  featured?: boolean;
  muted?: boolean;
  href?: string;
  footer?: React.ReactNode;
}) {
  const finished = total > 0 && done === total;
  return (
    <article data-sport={sportKey(sport)} className={`card lift group relative flex min-w-0 flex-col ${live ? "border-live/40" : ""}`}>
      <div className={`flex flex-1 flex-col gap-3 ${featured ? "p-5" : "p-4"}`}>
        <div className="flex items-center justify-between gap-2">
          <SportBadge name={sport} />
          {live ? (
            <span className="chip bg-live-solid text-white">
              <span className="live-dot size-1.5 rounded-full bg-white" /> {live} en cours
            </span>
          ) : finished ? (
            <span className="chip bg-ok-soft text-ok">Terminé</span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <Link href={href ?? `/t/${slug}`} className="after:absolute after:inset-0 after:rounded-xl">
            <h3 className={`display flex items-center gap-2 ${featured ? "text-[22px]" : "text-[19px]"} ${muted ? "text-ink-2" : ""}`}>
              <span className="min-w-0 truncate">{name}</span>
              <IconArrowRight className="size-4 shrink-0 text-ink-3 transition group-hover:text-accent" />
            </h3>
          </Link>
          <p className="mt-1 truncate text-[14px] text-ink-3">
            {fmtDate(date)}
            {subtitle && ` · ${subtitle}`}
          </p>
        </div>
        {total > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[13px] text-ink-3">
              <span>Matchs joués</span>
              <span className="font-semibold text-ink-2 tabular-nums">
                {done} / {total}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label="Matchs joués" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
              <div className={`h-full rounded-full ${finished ? "bg-ok" : "bg-accent"}`} style={{ width: `${(done / total) * 100}%` }} />
            </div>
          </div>
        )}
      </div>
      {footer && <div className="relative z-10 flex items-center gap-1 border-t border-line px-2 py-1.5">{footer}</div>}
    </article>
  );
}
