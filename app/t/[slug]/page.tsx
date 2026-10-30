import Link from "next/link";
import { Bracket } from "@/components/Bracket";
import { Commands, SearchButton } from "@/components/CommandPalette";
import { FollowTeam } from "@/components/FollowTeam";
import { IconBack, IconBolt, IconBracket, IconCalendar, IconList, IconScreen, IconSettings, IconTrophy, IconWhistle } from "@/components/Icons";
import { CourtLines, SportBadge, sportKey, Ticker } from "@/components/Stadium";
import { LiveRefresh } from "@/components/LiveRefresh";
import { MatchRow, Scoreboard } from "@/components/MatchRow";
import { Standings } from "@/components/Standings";
import { TeamFilter } from "@/components/TeamFilter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Empty, Footer, LedBar, Logo, Page, Section, TabBar } from "@/components/TopBar";
import { tournamentCommands } from "@/lib/commands";
import { teamSummaries } from "@/lib/follow";
import { champion, courtStatuses, forecast } from "@/lib/insights";
import { resolveTournament } from "@/lib/resolve";
import { canView, isOrganizer } from "@/lib/server/auth";
import { Gate } from "@/components/Gate";
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
  const t = b.tournament;
  if (!(await canView(t.id))) return <Gate name={t.name} sport={t.sport_name} slug={t.slug} />;
  const v = new View(b);
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
      <Footer />
    </>
  );
}

/** Bandeau du tournoi : le terrain du sport vu d'en haut, éclairé, avec l'état en direct et le défilant des résultats. */
function Hero({ v, org, now }: { v: View; org: boolean; now: number }) {
  const t = v.b.tournament;
  const base = `/t/${t.slug}`;
  const f = forecast(v.b, now);
  const champ = f.total && f.done === f.total ? champion(v.b) : null;
  const started = now >= new Date(t.start_at).getTime() || f.done > 0 || f.live > 0;
  const sport = sportKey(t.sport_name);
  const recent = v
    .playable()
    .filter((m) => m.status === "finished")
    .sort((a, b) => (b.finished_at ?? "").localeCompare(a.finished_at ?? ""))
    .slice(0, 8);
  return (
    <header data-sport={sport} className="theme-dark turf relative isolate overflow-hidden border-b border-line">
      <div aria-hidden className="floodlight absolute inset-0 -z-10">
        <CourtLines sport={sport} className="absolute top-1/2 right-[-12%] h-[150%] w-auto -translate-y-1/2 text-white/[0.13] sm:right-[-4%]" />
        <div className="absolute -top-20 left-[30%] h-[140%] w-48 -rotate-[20deg] bg-[linear-gradient(180deg,rgb(255_247_222/0.12),transparent_70%)] blur-2xl" />
        <div className="absolute -top-20 right-[12%] h-[140%] w-48 rotate-[20deg] bg-[linear-gradient(180deg,rgb(255_247_222/0.12),transparent_70%)] blur-2xl" />
      </div>
      <div className="mx-auto max-w-5xl px-3 pt-2 pb-6 sm:px-5 sm:pb-8">
        <div className="flex h-12 items-center gap-1">
          <Link href="/" data-vt className="btn-icon -ml-1" aria-label="Tous les tournois">
            <IconBack />
          </Link>
          <Link href="/" className="mr-auto hidden opacity-80 transition hover:opacity-100 sm:block" aria-label="Matchzy, accueil">
            <Logo />
          </Link>
          <span className="mr-auto sm:hidden" />
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
        <div className="rise mt-5 space-y-4 px-1">
          <div className="flex flex-wrap items-center gap-2">
            <SportBadge name={t.sport_name} vt={`sport-${t.slug}`} className="bg-black/40!" />
            {f.live > 0 ? (
              <span className="chip bg-live-solid text-white">
                <span className="live-dot size-1.5 rounded-full bg-white" /> {f.live} match{f.live > 1 ? "s" : ""} en direct
              </span>
            ) : champ ? (
              <span className="chip bg-ok text-on-ok">Terminé</span>
            ) : !started ? (
              <span className="chip bg-accent text-on-accent">Coup d&apos;envoi à {fmtTime(t.start_at, t.timezone)}</span>
            ) : null}
          </div>
          <h1 className="display max-w-3xl text-[clamp(3rem,9vw,6rem)] [text-shadow:0_4px_30px_rgb(0_0_0/0.5)]" style={{ viewTransitionName: `name-${t.slug}` }}>
            {t.name}
          </h1>
          <p className="font-cond text-[15px] font-semibold tracking-[0.08em] text-ink-2 uppercase">
            {fmtDate(t.date)} · {v.b.teams.length} équipes · {v.b.courts.length} {v.b.courts.length > 1 ? t.rules.labels.courtPlural : t.rules.labels.court}
          </p>
          {champ && (
            <div className="board inline-flex items-center gap-3 rounded-md py-2 pr-4 pl-3">
              <IconTrophy className="size-6 text-led" />
              <span className="font-cond text-[12px] font-bold tracking-[0.16em] text-ink-3 uppercase">Vainqueur</span>
              <span className="display text-[26px] text-led">{champ}</span>
            </div>
          )}
          {started && f.total > 0 && !champ && (
            <div className="flex max-w-lg items-center gap-3 pt-1">
              <LedBar value={f.done} total={f.total} cells={30} className="flex-1 text-white" />
              <span className="shrink-0 font-cond text-[13px] font-bold tracking-[0.06em] text-ink-2 uppercase tabular-nums">
                <span className="led text-[15px]">{f.done}</span>/{f.total} matchs
                {f.projectedEnd && ` · fin vers ${fmtTime(f.projectedEnd.toISOString(), t.timezone)}`}
              </span>
            </div>
          )}
        </div>
      </div>
      {recent.length > 0 && (
        <Ticker label="Résultats" className="border-t border-white/10">
          {recent.map((m) => (
            <span key={m.id} className="flex items-center gap-2.5 font-cond text-[15px] font-bold tracking-[0.04em] uppercase">
              <span className={m.winner_team_id === m.home_team_id ? "text-[#f3efe4]" : "text-[#858074]"}>{v.home(m)}</span>
              <span className="led text-[17px]">
                {m.home_score}-{m.away_score}
              </span>
              <span className={m.winner_team_id === m.away_team_id ? "text-[#f3efe4]" : "text-[#858074]"}>{v.away(m)}</span>
              <span className="text-[#ff6b1a]" aria-hidden>
                ◆
              </span>
            </span>
          ))}
        </Ticker>
      )}
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
        <ol className="relative space-y-6 border-l-2 border-dashed border-line-strong pl-5 sm:pl-7">
          {[...slots].map(([time, ms]) => {
            const state = ms.some((m) => m.status === "live") ? "live" : ms.every((m) => m.status === "finished") ? "done" : "todo";
            return (
              <li key={time} className="relative space-y-2">
                <span
                  className={`absolute top-2 -left-[27px] size-3 rounded-full ring-4 ring-canvas sm:-left-[35px] ${
                    state === "live" ? "live-ring bg-live" : state === "done" ? "bg-ink-3" : "bg-accent"
                  }`}
                />
                <div className={`display text-[28px] tabular-nums ${state === "done" ? "text-ink-3" : state === "live" ? "text-live" : ""}`}>{time}</div>
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
