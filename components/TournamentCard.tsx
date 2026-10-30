import Link from "next/link";
import { fmtDate } from "@/lib/view";
import { IconArrowRight } from "./Icons";
import { CourtLines, SportBadge, sportKey } from "./Stadium";
import { LedBar } from "./TopBar";

/**
 * Carte de tournoi : bandeau avec le terrain du sport vu d'en haut, nom en lettrage d'affiche,
 * avancement en LED. Utilisée par la liste de l'organisateur et par « Mes tournois » des participants.
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
  footer?: React.ReactNode;
}) {
  const finished = total > 0 && done === total;
  const key = sportKey(sport);
  return (
    // Pas d'overflow-hidden sur la carte : l'ombre d'élévation (lift) déborde ; le bandeau arrondit lui-même ses coins.
    <article
      data-sport={key}
      data-tilt
      className={`card lift tilt group flex flex-col hover:border-line-strong ${live ? "border-live/40" : ""}`}
    >
      <div className={`turf relative isolate overflow-hidden rounded-t-[9px] ${featured ? "h-32" : "h-24"} ${muted && !live ? "grayscale-[0.5]" : ""}`}>
        <CourtLines sport={key} className="absolute inset-0 -z-10 h-full w-full scale-110 p-2 text-white/35" />
        <div className="flex items-start justify-between gap-2 p-3">
          <SportBadge name={sport} vt={`sport-${slug}`} className="bg-black/45! text-white! backdrop-blur" />
          {live ? (
            <span className="chip bg-live text-white">
              <span className="live-dot size-1.5 rounded-full bg-white" /> {live} en cours
            </span>
          ) : finished ? (
            <span className="chip bg-ok text-on-ok">Terminé</span>
          ) : null}
        </div>
        {total > 0 && (
          <div className="absolute right-3 bottom-2.5 flex items-baseline gap-1 rounded-[4px] bg-black/60 px-1.5 py-1 backdrop-blur">
            <span className="led text-[18px] leading-none">{done}</span>
            <span className="font-cond text-[11px] font-bold text-white/60">/{total}</span>
          </div>
        )}
      </div>
      <div className={`flex flex-1 flex-col gap-3 ${featured ? "p-5" : "p-4"}`}>
        <div className="min-w-0 flex-1">
          <Link href={`/t/${slug}`} data-vt className="after:absolute after:inset-0">
            <h3 className={`display flex items-center gap-2 ${featured ? "text-[34px]" : "text-[26px]"} ${muted ? "text-ink-2" : ""}`}>
              <span className="min-w-0 truncate leading-[0.95]" style={{ viewTransitionName: `name-${slug}` }}>
                {name}
              </span>
              <IconArrowRight className="size-5 shrink-0 text-ink-3 transition group-hover:translate-x-1 group-hover:text-accent" />
            </h3>
          </Link>
          <p className="mt-1.5 truncate font-cond text-[13px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
            {fmtDate(date)}
            {subtitle && ` · ${subtitle}`}
          </p>
        </div>
        {total > 0 && (done > 0 || featured) && <LedBar value={done} total={total} tone={finished ? "ok" : "led"} className="text-ink" />}
      </div>
      {footer && <div className="relative z-10 flex items-center gap-1 border-t border-dashed border-line-strong px-2 py-1.5">{footer}</div>}
    </article>
  );
}
