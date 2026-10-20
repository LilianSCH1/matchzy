import { Bracket } from "@/components/Bracket";
import { LiveRefresh } from "@/components/LiveRefresh";
import { MatchRow, Scoreboard } from "@/components/MatchRow";
import { Clock, Rotator } from "@/components/Rotator";
import { StandingsTable } from "@/components/StandingsTable";
import { Logo } from "@/components/TopBar";
import { courtStatuses, forecast } from "@/lib/insights";
import { resolveTournament } from "@/lib/resolve";
import { bundleOr404 } from "@/lib/server/page";
import type { Match } from "@/lib/types";
import { byTime, View } from "@/lib/view";

export const dynamic = "force-dynamic";

/** Écran géant : lecture seule, sans connexion, rafraîchi en direct. */
export default async function BigScreen({ params }: { params: Promise<{ slug: string }> }) {
  const b = await bundleOr404((await params).slug);
  const v = new View(b);
  const t = b.tournament;
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
            <StandingsTable key={p.id} title={`Poule ${p.name}`} rows={r.standings.get(p.id) ?? []} rules={t.rules} qualified={q} big />
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

  return (
    <div className="theme-dark scoreboard-grid flex h-dvh flex-col overflow-hidden">
      <LiveRefresh seconds={5} />
      <header className="flex items-center gap-6 px-8 pt-6">
        <Logo className="opacity-90" />
        <div className="h-8 w-px bg-line" />
        <h1 className="truncate text-4xl font-semibold tracking-[-0.03em]">{t.name}</h1>
        <span className="chip h-8 shrink-0 bg-surface-3 px-4 text-base text-ink-2">{t.sport_name}</span>
        {f.live > 0 && (
          <span className="chip h-8 shrink-0 bg-live px-4 text-base text-white">
            <span className="live-dot size-2 rounded-full bg-white" /> {f.live} en direct
          </span>
        )}
        <div className="ml-auto flex items-center gap-6">
          <div className="w-40 space-y-1.5 text-right">
            <div className="text-sm text-ink-2 tabular-nums">
              {f.done}/{f.total} matchs
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <span className="text-6xl font-semibold tracking-tight tabular-nums">
            <Clock tz={t.timezone} />
          </span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-8 px-8 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <section className="flex min-h-0 flex-col gap-4">
          <h2 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
            <span className="live-dot size-3 rounded-full bg-live" /> Sur les {t.rules.labels.courtPlural}
          </h2>
          <div className={`grid min-h-0 gap-3 overflow-hidden ${cols}`}>
            {boards.length ? (
              boards.map(({ c, m }) => <Scoreboard key={c.courtId} m={m} v={v} court={c.name} now={now} size={boards.length > 3 ? "md" : "lg"} />)
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
        <footer className="flex h-14 shrink-0 items-center overflow-hidden border-t border-line bg-surface/80">
          <span className="z-10 flex h-full shrink-0 items-center bg-accent px-6 text-sm font-semibold tracking-wide text-on-accent uppercase">Résultats</span>
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <div className="ticker flex w-max gap-10 pl-10 text-lg whitespace-nowrap">
              {[...recent, ...recent].map((m, i) => (
                <span key={`${m.id}-${i}`} className="flex items-center gap-3">
                  <span className={m.winner_team_id === m.home_team_id ? "font-semibold" : "text-ink-2"}>{v.home(m)}</span>
                  <span className="rounded-md bg-surface-3 px-2 font-semibold tabular-nums">
                    {m.home_score} – {m.away_score}
                  </span>
                  <span className={m.winner_team_id === m.away_team_id ? "font-semibold" : "text-ink-2"}>{v.away(m)}</span>
                  <span className="text-sm text-ink-3">{m.label}</span>
                </span>
              ))}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
