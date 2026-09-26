import { Bracket } from "@/components/Bracket";
import { LiveRefresh } from "@/components/LiveRefresh";
import { MatchRow } from "@/components/MatchRow";
import { Clock, Rotator } from "@/components/Rotator";
import { StandingsTable } from "@/components/StandingsTable";
import { Logo } from "@/components/TopBar";
import { resolveTournament } from "@/lib/resolve";
import { bundleOr404 } from "@/lib/server/page";
import { byTime, View } from "@/lib/view";

export const dynamic = "force-dynamic";

/** Écran géant : lecture seule, sans connexion, rafraîchi en direct. */
export default async function BigScreen({ params }: { params: Promise<{ slug: string }> }) {
  const b = await bundleOr404((await params).slug);
  const v = new View(b);
  const t = b.tournament;
  const live = v.live().sort(byTime);
  const next = v
    .nextByCourt(1)
    .flatMap((x) => x.matches)
    .sort(byTime);
  const r = resolveTournament(b);
  const q = t.format === "pools_knockout" ? t.qualifiers_per_pool : t.format === "pools" ? 1 : 0;

  // Les poules sont affichées par groupes de 4 pour rester lisibles.
  const panels: { title: string; node: React.ReactNode }[] = [];
  for (let i = 0; i < b.pools.length; i += 4) {
    const group = b.pools.slice(i, i + 4);
    panels.push({
      title: group.length === 1 ? `Poule ${group[0].name}` : `Poules ${group.map((p) => p.name).join(", ")}`,
      node: (
        <div className="grid grid-cols-2 gap-4">
          {group.map((p) => (
            <StandingsTable key={p.id} title={`Poule ${p.name}`} rows={r.standings.get(p.id) ?? []} rules={t.rules} qualified={q} big />
          ))}
        </div>
      ),
    });
  }
  if (t.format !== "pools") panels.push({ title: "Phase finale", node: <Bracket v={v} big /> });

  return (
    <div className="theme-dark flex h-dvh flex-col gap-6 overflow-hidden p-8">
      <LiveRefresh seconds={5} />
      <header className="flex items-center gap-6">
        <Logo className="opacity-80" />
        <div className="h-8 w-px bg-line" />
        <h1 className="truncate text-4xl font-semibold tracking-tight">{t.name}</h1>
        <span className="chip h-8 bg-surface-2 px-4 text-base text-ink-2">{t.sport_name}</span>
        <span className="ml-auto text-5xl font-semibold tracking-tight tabular-nums">
          <Clock tz={t.timezone} />
        </span>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="min-h-0 space-y-8 overflow-hidden">
          <div className="space-y-3">
            <h2 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-live">
              <span className="live-dot size-3 rounded-full bg-live" /> En cours
            </h2>
            <div className="space-y-2">
              {live.length ? live.map((m) => <MatchRow key={m.id} m={m} v={v} big />) : <p className="text-xl text-ink-3">Aucun match en cours</p>}
            </div>
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold tracking-tight">À suivre</h2>
            <div className="space-y-2">
              {next.map((m) => (
                <MatchRow key={m.id} m={m} v={v} big />
              ))}
            </div>
          </div>
        </div>
        <div className="min-h-0">
          <Rotator panels={panels} seconds={15} />
        </div>
      </div>
    </div>
  );
}
