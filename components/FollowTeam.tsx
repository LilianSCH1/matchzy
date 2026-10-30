"use client";

// « Mon équipe » : le spectateur choisit son équipe (mémorisée sur son téléphone) et voit
// d'un coup d'œil son prochain match, son dernier résultat et sa position.
import Link from "next/link";
import { useEffect, useState } from "react";
import type { TeamMatchBrief, TeamSummary } from "@/lib/follow";
import { fmtTime } from "@/lib/view";
import { IconChevron, IconDown, IconStar, IconStarFill, IconX } from "./Icons";

const key = (slug: string) => `matchzy:follow:${slug}`;

export function useFollowedTeam(slug: string): [string | null, (id: string | null) => void] {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    try {
      setId(localStorage.getItem(key(slug)));
    } catch {}
  }, [slug]);
  const set = (next: string | null) => {
    setId(next);
    try {
      if (next) localStorage.setItem(key(slug), next);
      else localStorage.removeItem(key(slug));
    } catch {}
  };
  return [id, set];
}

const RESULT = {
  W: { label: "V", cls: "bg-ok text-on-ok", title: "Victoire" },
  D: { label: "N", cls: "bg-surface-3 text-ink-2", title: "Nul" },
  L: { label: "D", cls: "bg-live-soft text-live", title: "Défaite" },
} as const;

export function FollowTeam({ slug, tz, teams, courtLabel }: { slug: string; tz: string; teams: TeamSummary[]; courtLabel: string }) {
  const [id, setId] = useFollowedTeam(slug);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const team = id ? teams.find((t) => t.id === id) : undefined;
  const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name));

  if (!team)
    return (
      <div className="card flex flex-wrap items-center gap-3 border-dashed border-line-strong p-3 pl-4">
        <span className="grid size-10 shrink-0 -rotate-3 place-items-center rounded-md border-2 border-dashed border-accent text-accent-ink">
          <IconStar className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="display text-[20px]">Suivez votre équipe</div>
          <div className="text-xs text-ink-3">Prochain match, {courtLabel} et résultats, toujours en haut de page.</div>
        </div>
        <label className="relative w-full sm:w-60">
          <span className="sr-only">Choisir une équipe</span>
          <select className="input h-10 appearance-none pr-9 text-sm" value="" onChange={(e) => e.target.value && setId(e.target.value)}>
            <option value="">Choisir une équipe…</option>
            {sorted.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <IconDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-3" />
        </label>
      </div>
    );

  return (
    <div className="card overflow-hidden">
      {/* Vignette façon album d'autocollants : bandeau aux couleurs du club, nom en grand. */}
      <div className="flex items-center gap-3 border-b border-line bg-[linear-gradient(100deg,var(--accent)_0_10px,transparent_10px)] py-3 pr-4 pl-6">
        <span className="grid size-10 shrink-0 -rotate-3 place-items-center rounded-md bg-accent text-on-accent shadow-[inset_0_-3px_0_rgb(0_0_0/0.25)]">
          <IconStarFill className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="display truncate text-[26px]">{team.name}</div>
          <div className={`truncate text-xs ${team.qualifying ? "font-medium text-ok" : "text-ink-3"}`}>
            {team.headline}
            {team.qualifying && " · en position de qualification"}
          </div>
        </div>
        {team.form.length > 0 && (
          <div className="hidden items-center gap-1 sm:flex" aria-label="Forme">
            {team.form.map((r, i) => (
              <span key={i} title={RESULT[r].title} className={`grid size-6 place-items-center rounded-[4px] text-[12px] font-bold ${RESULT[r].cls}`}>
                {RESULT[r].label}
              </span>
            ))}
          </div>
        )}
        <button className="btn-icon size-8" onClick={() => setId(null)} aria-label="Ne plus suivre" title="Ne plus suivre">
          <IconX className="size-4" />
        </button>
      </div>
      <div className="grid divide-line sm:grid-cols-2 sm:divide-x">
        <Brief title={team.next?.live ? "En cours" : "Prochain match"} m={team.next} tz={tz} now={now} empty={team.withdrawn ? "Abandon" : "Plus de match prévu"} />
        <Brief title="Dernier résultat" m={team.last} tz={tz} now={now} empty="Pas encore joué" className="border-t border-line sm:border-t-0" />
      </div>
      <Link href={`/t/${slug}?v=programme&equipe=${team.id}`} scroll={false} className="flex items-center justify-between border-t border-line bg-surface-2/50 px-4 py-2.5 text-[14px] font-bold text-accent-ink transition hover:bg-surface-2">
        Tous ses matchs{team.remaining ? ` · ${team.remaining} à jouer` : ""}
        <IconChevron className="size-4" />
      </Link>
    </div>
  );
}

function Brief({ title, m, tz, now, empty, className = "" }: { title: string; m: TeamMatchBrief | null; tz: string; now: number; empty: string; className?: string }) {
  if (!m)
    return (
      <div className={`px-4 py-3 ${className}`}>
        <div className="eyebrow">{title}</div>
        <div className="mt-1 text-sm text-ink-3">{empty}</div>
      </div>
    );
  const mins = m.at ? Math.round((new Date(m.at).getTime() - now) / 60000) : null;
  const played = m.us !== null;
  return (
    <div className={`px-4 py-3 ${className}`}>
      <div className="flex items-center gap-2">
        <span className={`eyebrow ${m.live ? "text-live" : ""}`}>{title}</span>
        {m.live && <span className="live-dot size-1.5 rounded-full bg-live" />}
        <span className="ml-auto text-xs text-ink-3 tabular-nums">
          {fmtTime(m.at, tz)}
          {m.court && ` · ${m.court}`}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm">
          <span className="text-ink-3">contre </span>
          <span className="font-semibold">{m.opponent}</span>
        </span>
        {played ? (
          <span className={` text-2xl font-bold tabular-nums ${m.result === "W" ? "text-ok" : m.result === "L" ? "text-live" : ""}`}>
            {m.us}–{m.them}
          </span>
        ) : mins !== null && mins >= 0 && mins <= 120 ? (
          <span className="chip bg-accent-soft text-accent-ink tabular-nums">dans {mins} min</span>
        ) : mins !== null && mins < 0 ? (
          <span className="chip bg-warn-soft text-warn">imminent</span>
        ) : null}
      </div>
      {m.label && <div className="mt-0.5 truncate text-xs text-ink-3">{m.label}</div>}
    </div>
  );
}
