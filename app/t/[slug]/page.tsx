import Link from "next/link";
import { Bracket } from "@/components/Bracket";
import { Commands, SearchButton } from "@/components/CommandPalette";
import { FollowTeam } from "@/components/FollowTeam";
import { IconBack, IconBolt, IconBracket, IconCalendar, IconList, IconScreen, IconSettings, IconWhistle } from "@/components/Icons";
import { LiveRefresh } from "@/components/LiveRefresh";
import { MatchRow, Scoreboard } from "@/components/MatchRow";
import { Standings } from "@/components/Standings";
import { TeamFilter } from "@/components/TeamFilter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Empty, Page, Section, TabBar } from "@/components/TopBar";
import { tournamentCommands } from "@/lib/commands";
import { teamSummaries } from "@/lib/follow";
import { champion, courtStatuses, forecast } from "@/lib/insights";
import { resolveTournament } from "@/lib/resolve";
import { isOrganizer } from "@/lib/server/auth";
import { bundleOr404 } from "@/lib/server/page";
import type { Match } from "@/lib/types";
import { byTime, fmtDate, fmtTime, View } from "@/lib/view";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ v?: string; equipe?: string }> };

export async function generateMetadata({ params }: Params) {
  const b = await bundleOr404((await params).slug);
  return { title: `${b.tournament.name} — Matchzy` };
}

export default async function PublicPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const { v: tab = "direct", equipe } = await searchParams;
  const [b, org] = await Promise.all([bundleOr404(slug), isOrganizer()]);
  const v = new View(b);
  const t = b.tournament;
  const base = `/t/${t.slug}`;
  const now = Date.now();
  const r = resolveTournament(b, new Date(now));
  const ic = "size-5 sm:size-4";
  const tabs = [
    { key: "direct", label: "Direct", href: base, icon: <IconBolt className={ic} /> },
    ...(t.format !== "knockout" ? [{ key: "classements", label: "Classements", href: `${base}?v=classements`, icon: <IconList className={ic} /> }] : []),
    ...(t.format !== "pools" ? [{ key: "tableau", label: "Phase finale", href: `${base}?v=tableau`, icon: <IconBracket className={ic} /> }] : []),
    { key: "programme", label: "Programme", href: `${base}?v=programme`, icon: <IconCalendar className={ic} /> },
  ];

  return (
    <>
      <LiveRefresh />
      <Commands groups={tournamentCommands(b, { org })} />
      <Hero v={v} org={org} now={now} />
      <TabBar items={tabs} active={tab} dock />
      <Page className="pb-28 sm:pb-16">
        {tab === "direct" && (
          <>
            <FollowTeam slug={t.slug} tz={t.timezone} courtLabel={t.rules.labels.court} teams={Object.values(teamSummaries(b, r))} />
            <Live v={v} now={now} />
          </>
        )}
        {tab === "classements" && <Standings v={v} />}
        {tab === "tableau" && <Bracket v={v} />}
        {tab === "programme" && <Programme v={v} team={equipe} base={base} />}
      </Page>
    </>
  );
}

/** Bandeau « tableau d'affichage » : identité du tournoi et état en direct. */
function Hero({ v, org, now }: { v: View; org: boolean; now: number }) {
  const t = v.b.tournament;
  const base = `/t/${t.slug}`;
  const f = forecast(v.b, now);
  const pct = f.total ? Math.round((100 * f.done) / f.total) : 0;
  const champ = f.total && f.done === f.total ? champion(v.b) : null;
  const started = now >= new Date(t.start_at).getTime() || f.done > 0 || f.live > 0;
  return (
    <header className="theme-dark scoreboard-grid border-b border-line">
      <div className="mx-auto max-w-5xl px-3 pt-2 pb-5 sm:px-5 sm:pb-6">
        <div className="flex h-12 items-center gap-1">
          <Link href="/" className="btn-icon -ml-1" aria-label="Tous les tournois">
            <IconBack />
          </Link>
          <span className="mr-auto" />
          {org && (
            <Link href={`${base}/admin`} className="btn-quiet h-9 gap-1.5 px-2.5 text-sm" title="Organiser">
              <IconSettings className="size-4" />
              <span className="hidden sm:inline">Organiser</span>
            </Link>
          )}
          <Link href={`${base}/arbitre`} className="btn-quiet h-9 gap-1.5 px-2.5 text-sm" title="Arbitrer">
            <IconWhistle className="size-4" />
            <span className="hidden sm:inline">Arbitrer</span>
          </Link>
          <Link href={`${base}/ecran`} className="btn-quiet hidden h-9 gap-1.5 px-2.5 text-sm sm:inline-flex" title="Écran géant">
            <IconScreen className="size-4" />
            <span className="hidden sm:inline">Écran géant</span>
          </Link>
          <SearchButton compact />
          <ThemeToggle />
        </div>
        <div className="rise mt-3 space-y-3 px-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip bg-surface-3 text-ink-2">{t.sport_name}</span>
            {f.live > 0 ? (
              <span className="chip bg-live text-white">
                <span className="live-dot size-1.5 rounded-full bg-white" /> {f.live} match{f.live > 1 ? "s" : ""} en direct
              </span>
            ) : champ ? (
              <span className="chip bg-ok text-on-ok">Terminé</span>
            ) : !started ? (
              <span className="chip bg-accent text-on-accent">Début à {fmtTime(t.start_at, t.timezone)}</span>
            ) : null}
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">{t.name}</h1>
          <p className="text-sm text-ink-2 first-letter:uppercase">
            {fmtDate(t.date)} · {v.b.teams.length} équipes
            {champ && (
              <>
                {" "}
                · vainqueur <span className="font-semibold text-ink">{champ}</span>
              </>
            )}
          </p>
          {started && f.total > 0 && (
            <div className="flex max-w-md items-center gap-3 pt-1">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-ink-2 tabular-nums">
                {f.done}/{f.total} matchs
                {f.projectedEnd && !champ && ` · fin vers ${fmtTime(f.projectedEnd.toISOString(), t.timezone)}`}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Live({ v, now }: { v: View; now: number }) {
  const courts = courtStatuses(v.b, now);
  const shown = new Set<string>();
  const L = v.b.tournament.rules.labels;
  const boards = courts
    .map((c) => {
      const m = c.live ?? c.next;
      if (m) shown.add(m.id);
      return { c, m };
    })
    .filter((x): x is { c: (typeof courts)[number]; m: Match } => !!x.m);
  const upcoming = v
    .playable()
    .filter((m) => m.status === "scheduled" && !shown.has(m.id))
    .sort(byTime)
    .slice(0, 6);
  const recent = v
    .playable()
    .filter((m) => m.status === "finished")
    .sort((a, b) => (b.finished_at ?? "").localeCompare(a.finished_at ?? ""))
    .slice(0, 6);
  return (
    <>
      <Section title={`Sur les ${L.courtPlural}`} hint={courts.some((c) => c.live) ? "Scores mis à jour en direct." : `Le prochain match de chaque ${L.court}.`}>
        {boards.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {boards.map(({ c, m }) => (
              <Scoreboard key={c.courtId} m={m} v={v} court={c.name} now={now} />
            ))}
          </div>
        ) : (
          <Empty icon={<IconBolt className="size-5" />}>Tous les matchs sont joués. Consultez les classements et la phase finale.</Empty>
        )}
      </Section>
      {upcoming.length > 0 && (
        <Section title="Ensuite">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {upcoming.map((m) => (
              <MatchRow key={m.id} m={m} v={v} />
            ))}
          </div>
        </Section>
      )}
      {recent.length > 0 && (
        <Section title="Derniers résultats">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {recent.map((m) => (
              <MatchRow key={m.id} m={m} v={v} />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function Programme({ v, team, base }: { v: View; team?: string; base: string }) {
  const list = v
    .playable()
    .filter((m) => !team || m.home_team_id === team || m.away_team_id === team)
    .sort(byTime);
  const teams = [...v.b.teams].sort((a, b) => a.name.localeCompare(b.name)).map((t) => ({ id: t.id, name: t.name }));
  // Regroupement par créneau horaire
  const slots = new Map<string, Match[]>();
  for (const m of list) {
    const k = fmtTime(m.scheduled_at, v.tz);
    slots.set(k, [...(slots.get(k) ?? []), m]);
  }
  const live = list.filter((m) => m.status === "live").length;
  const done = list.filter((m) => m.status === "finished").length;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:max-w-xs">
          <TeamFilter base={base} teams={teams} value={team} />
        </div>
        <p className="text-sm text-ink-3 tabular-nums">
          {list.length} match{list.length > 1 ? "s" : ""} · {done} joué{done > 1 ? "s" : ""}
          {live > 0 && ` · ${live} en cours`}
        </p>
      </div>
      {list.length ? (
        <ol className="relative space-y-5 border-l border-line pl-5 sm:pl-6">
          {[...slots].map(([time, ms]) => {
            const state = ms.some((m) => m.status === "live") ? "live" : ms.every((m) => m.status === "finished") ? "done" : "todo";
            return (
              <li key={time} className="relative space-y-2">
                <span
                  className={`absolute top-1 -left-[25.5px] size-2.5 rounded-full ring-4 ring-canvas sm:-left-[29.5px] ${
                    state === "live" ? "live-ring bg-live" : state === "done" ? "bg-ink-3" : "bg-line-strong"
                  }`}
                />
                <div className={`text-sm font-semibold tabular-nums ${state === "done" ? "text-ink-3" : ""}`}>{time}</div>
                <div className="grid gap-2 md:grid-cols-2">
                  {ms.map((m) => (
                    <MatchRow key={m.id} m={m} v={v} highlight={team} />
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <Empty>Aucun match.</Empty>
      )}
    </div>
  );
}
