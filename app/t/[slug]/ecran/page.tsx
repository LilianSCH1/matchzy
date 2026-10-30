import { Bracket } from "@/components/Bracket";
import { LiveRefresh } from "@/components/LiveRefresh";
import { MatchRow, Scoreboard } from "@/components/MatchRow";
import { Clock, Rotator } from "@/components/Rotator";
import { BoardFx, CelebrationHost } from "@/components/screen/Celebrations";
import { LiveRows } from "@/components/screen/LiveRows";
import { Projection } from "@/components/screen/Projection";
import { SoundToggle } from "@/components/SoundToggle";
import { FloodlightsLoader } from "@/components/stage/FloodlightsLoader";
import { StandingsTable } from "@/components/StandingsTable";
import { CourtLines, SportBadge, sportKey, Ticker } from "@/components/Stadium";
import { LedBar, Logo } from "@/components/TopBar";
import { courtStatuses, forecast } from "@/lib/insights";
import { resolveTournament } from "@/lib/resolve";
import { bundleOr404 } from "@/lib/server/page";
import { canView } from "@/lib/server/auth";
import { Gate } from "@/components/Gate";
import type { Match } from "@/lib/types";
import { byTime, fmtTime, View } from "@/lib/view";

export const dynamic = "force-dynamic";

/** Écran géant : lecture seule (code participant, organisateur ou arbitre), rafraîchi en direct. */
export default async function BigScreen({ params }: { params: Promise<{ slug: string }> }) {
  const b = await bundleOr404((await params).slug);
  const t = b.tournament;
  if (!(await canView(t.id))) return <Gate name={t.name} sport={t.sport_name} slug={t.slug} />;
  const v = new View(b);
  const now = Date.now();
  const courts = courtStatuses(b, now);
  const f = forecast(b, now, courts);
  const r = resolveTournament(b);
  const q = t.format === "pools_knockout" ? t.qualifiers_per_pool : t.format === "pools" ? 1 : 0;

  const boards = courts.map((c) => ({ c, m: c.live ?? c.next })).filter((x): x is { c: (typeof courts)[number]; m: Match } => !!x.m);
  const shown = new Set(boards.map((x) => x.m.id));
  const next = v
    .playable()
    .filter((m) => m.status === "scheduled" && !shown.has(m.id))
    .sort(byTime)
    .slice(0, 6);
  const recent = v
    .playable()
    .filter((m) => m.status === "finished")
    .sort((a, c) => (c.finished_at ?? "").localeCompare(a.finished_at ?? ""))
    .slice(0, 12);

  // Les poules sont affichées par groupes de 4 pour rester lisibles.
  const panels: { title: string; node: React.ReactNode }[] = [];
  for (let i = 0; i < b.pools.length; i += 4) {
    const group = b.pools.slice(i, i + 4);
    panels.push({
      title: group.length === 1 ? `Poule ${group[0].name}` : `Poules ${group.map((p) => p.name).join(", ")}`,
      node: (
        <div className={`grid gap-4 ${group.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {group.map((p) => (
            <StandingsTable key={p.id} title={`Poule ${p.name}`} rows={r.standings.get(p.id) ?? []} rules={t.rules} qualified={q} big body={(items) => <LiveRows items={items} />} />
          ))}
        </div>
      ),
    });
  }
  if (t.format !== "pools") panels.push({ title: "Phase finale", node: <Bracket v={v} big /> });
  if (next.length)
    panels.push({
      title: "À suivre",
      node: (
        <div className="grid grid-cols-2 gap-3">
          {next.map((m) => (
            <MatchRow key={m.id} m={m} v={v} big />
          ))}
        </div>
      ),
    });

  const pct = f.total ? Math.round((100 * f.done) / f.total) : 0;
  const cols = boards.length > 3 ? "grid-cols-2" : "grid-cols-1";
  // Annonce à chaque but ou set gagné ; au basket et au rugby on marque sans cesse : flash seulement.
  const word = t.rules.scoreType === "goals" ? t.rules.labels.score : t.rules.scoreType === "sets" ? t.rules.labels.set : null;
  const liveScores = boards
    .filter(({ m }) => m.status === "live")
    .map(({ c, m }) => ({ id: m.id, live: true, home: m.home_score, away: m.away_score, court: c.name, homeName: v.home(m), awayName: v.away(m) }));

  return (
    <div id="ecran" data-sport={sportKey(t.sport_name)} className="theme-dark relative isolate flex h-dvh flex-col overflow-hidden transition-[translate] duration-[2s]">
      <FloodlightsLoader intensity={0.5} className="-z-10" />
      <CourtLines sport={sportKey(t.sport_name)} className="absolute inset-0 -z-10 m-auto h-[90%] w-auto text-white/[0.035]" />
      <LiveRefresh seconds={5} />
      <Projection target="ecran" />
      <CelebrationHost matches={liveScores} word={word} />
      <header className="board flex items-center gap-6 px-8 py-4">
        <Logo className="opacity-90" />
        <div className="h-10 w-px bg-white/15" />
        <h1 className="display truncate text-[56px]">{t.name}</h1>
        <SportBadge name={t.sport_name} className="h-8 px-3 text-base" />
        {f.live > 0 && (
          <span className="chip h-8 shrink-0 bg-live px-4 text-base text-white">
            <span className="live-dot size-2 rounded-full bg-white" /> {f.live} en direct
          </span>
        )}
        <div className="ml-auto flex items-center gap-6">
          {/* Les navigateurs exigent un geste pour jouer du son : un clic suffit pour toute la journée. */}
          <SoundToggle label="Son de stade" className="h-10 border-white/15 bg-white/5 text-[#f3efe4] hover:bg-white/10" />
          <div className="w-48 space-y-1.5 text-right">
            <div className="font-cond text-base font-bold tracking-[0.08em] text-ink-2 uppercase tabular-nums">
              <span className="led text-xl">{f.done}</span>/{f.total} matchs · {pct} %
            </div>
            <LedBar value={f.done} total={f.total} cells={24} className="text-white" />
          </div>
          <span className="led rounded-md bg-black px-3 py-1 text-[64px] leading-none">
            <Clock tz={t.timezone} initial={fmtTime(new Date(now).toISOString(), t.timezone)} />
          </span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-8 px-8 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <section className="flex min-h-0 flex-col gap-4">
          <h2 className="display flex items-center gap-3 text-[40px]">
            <span className="live-dot size-3 rounded-full bg-live" /> Sur les {t.rules.labels.courtPlural}
          </h2>
          <div className={`grid min-h-0 gap-3 overflow-hidden ${cols}`}>
            {boards.length ? (
              boards.map(({ c, m }) => (
                <BoardFx key={c.courtId} matchId={m.status === "live" ? m.id : null}>
                  <Scoreboard m={m} v={v} court={c.name} now={now} size={boards.length > 3 ? "md" : "lg"} />
                </BoardFx>
              ))
            ) : (
              <p className="text-xl text-ink-3">Tous les matchs sont joués.</p>
            )}
          </div>
        </section>
        <section className="min-h-0">
          <Rotator panels={panels} seconds={15} />
        </section>
      </div>

      {recent.length > 0 && (
        <Ticker label="Résultats" className="h-14 shrink-0 border-t border-white/10 [&>span]:px-6 [&>span]:text-base">
          {recent.map((m) => (
            <span key={m.id} className="flex items-center gap-3 font-cond text-2xl font-bold tracking-[0.03em] uppercase">
              <span className={m.winner_team_id === m.home_team_id ? "text-ink" : "text-ink-3"}>{v.home(m)}</span>
              <span className="led text-[26px]">
                {m.home_score}-{m.away_score}
              </span>
              <span className={m.winner_team_id === m.away_team_id ? "text-ink" : "text-ink-3"}>{v.away(m)}</span>
              <span className="text-base text-ink-3">{m.label}</span>
              <span className="text-accent" aria-hidden>
                ◆
              </span>
            </span>
          ))}
        </Ticker>
      )}
    </div>
  );
}
