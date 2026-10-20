import Link from "next/link";
import { CourtBoard } from "@/components/CourtBoard";
import { IconBracket, IconClock, IconPulse, IconScreen, IconTarget, IconWhistle } from "@/components/Icons";
import { InsightsPanel } from "@/components/InsightsPanel";
import { MatchRow } from "@/components/MatchRow";
import { Empty, Page, PageHeader, Ring, Section } from "@/components/TopBar";
import { courtStatuses, forecast, tournamentInsights } from "@/lib/insights";
import { resolveTournament } from "@/lib/resolve";
import { bundleOr404 } from "@/lib/server/page";
import { fmtDate, fmtTime, View } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function Dashboard({ params }: { params: Promise<{ slug: string }> }) {
  const b = await bundleOr404((await params).slug);
  const v = new View(b);
  const t = b.tournament;
  const L = t.rules.labels;
  const pub = `/t/${t.slug}`;
  const now = Date.now();
  const r = resolveTournament(b, new Date(now));
  const courts = courtStatuses(b, now);
  const f = forecast(b, now, courts);
  const insights = tournamentInsights(b, now, r);
  const pct = f.total ? Math.round((100 * f.done) / f.total) : 0;
  const lateCourts = courts.filter((c) => c.state === "late").length;
  const slip = f.projectedEnd && f.plannedEnd ? Math.round((f.projectedEnd.getTime() - f.plannedEnd.getTime()) / 60000) : 0;
  const recent = v
    .playable()
    .filter((m) => m.status === "finished")
    .sort((a, c) => (c.finished_at ?? "").localeCompare(a.finished_at ?? ""))
    .slice(0, 4);

  // Avancement par phase
  const all = v.playable();
  const phases = [
    ...b.pools.map((p) => {
      const list = all.filter((m) => m.pool_id === p.id);
      return { key: p.id, label: `Poule ${p.name}`, done: list.filter((m) => m.status === "finished").length, total: list.length };
    }),
    ...(t.format !== "pools"
      ? [
          (() => {
            const list = all.filter((m) => m.phase === "knockout");
            return { key: "ko", label: "Phase finale", done: list.filter((m) => m.status === "finished").length, total: list.length };
          })(),
        ]
      : []),
  ].filter((p) => p.total > 0);

  return (
    <Page wide>
      <PageHeader
        eyebrow="Tableau de bord"
        title="Pilotage en direct"
        description={
          <span className="first-letter:uppercase">
            {fmtDate(t.date)} · {t.sport_name} · {b.teams.length} équipes · {b.courts.length} {b.courts.length > 1 ? L.courtPlural : L.court}
          </span>
        }
        actions={
          <>
            <Link href={`${pub}/ecran`} target="_blank" className="btn-outline h-10 text-sm">
              <IconScreen className="size-4" /> Écran géant
            </Link>
            <Link href={`${pub}/arbitre`} className="btn-accent h-10 text-sm">
              <IconWhistle className="size-4" /> Saisir les scores
            </Link>
          </>
        }
      />

      {/* Indicateurs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Progression" icon={<IconTarget className="size-4" />}>
          <div className="flex items-center gap-3">
            <Ring value={pct} size={40} stroke={5} />
            <div>
              <div className="text-2xl font-semibold tracking-tight tabular-nums">{pct} %</div>
              <div className="text-xs text-ink-3 tabular-nums">
                {f.done} / {f.total} matchs
              </div>
            </div>
          </div>
        </Kpi>
        <Kpi label="En cours" icon={<IconPulse className="size-4" />} tone={f.live ? "live" : undefined}>
          <div className="text-3xl font-semibold tracking-tight tabular-nums">{f.live}</div>
          <div className="text-xs text-ink-3">
            sur {b.courts.length} {b.courts.length > 1 ? L.courtPlural : L.court}
          </div>
        </Kpi>
        <Kpi label="Retard" icon={<IconClock className="size-4" />} tone={f.maxDelay >= 5 ? "warn" : undefined}>
          <div className="text-3xl font-semibold tracking-tight tabular-nums">
            {f.maxDelay}
            <span className="ml-1 text-base font-medium text-ink-3">min</span>
          </div>
          <div className="text-xs text-ink-3">{lateCourts ? `${lateCourts} ${lateCourts > 1 ? `${L.courtPlural} en retard` : `${L.court} en retard`}` : "Planning tenu"}</div>
        </Kpi>
        <Kpi label="Fin projetée" icon={<IconBracket className="size-4" />}>
          <div className="text-3xl font-semibold tracking-tight tabular-nums">{f.projectedEnd ? fmtTime(f.projectedEnd.toISOString(), t.timezone) : "–"}</div>
          <div className={`text-xs ${slip > 0 ? "text-warn" : "text-ink-3"}`}>
            {slip > 0 ? `+${slip} min sur le planning` : f.plannedEnd ? `Prévue à ${fmtTime(f.plannedEnd.toISOString(), t.timezone)}` : ""}
          </div>
        </Kpi>
      </div>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-8">
          <Section
            title={`${L.courtPlural[0].toUpperCase()}${L.courtPlural.slice(1)} en direct`}
            hint={`Touchez un match pour saisir le score. « +5 min » repousse le prochain match et tous les suivants du ${L.court}.`}
          >
            <CourtBoard courts={courts} v={v} base={pub} now={now} />
          </Section>

          {phases.length > 1 && (
            <Section title="Avancement" hint={t.format === "pools_knockout" ? "La phase finale se remplit automatiquement à la fin des poules." : undefined}>
              <div className="card divide-y divide-line">
                {phases.map((p) => {
                  const done = p.done === p.total;
                  return (
                    <div key={p.key} className="flex items-center gap-4 px-4 py-2.5 text-sm">
                      <span className="w-28 shrink-0 truncate font-medium">{p.label}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div className={`h-full rounded-full transition-[width] duration-700 ${done ? "bg-ok" : "bg-accent"}`} style={{ width: `${(100 * p.done) / p.total}%` }} />
                      </div>
                      <span className={`w-14 text-right text-xs tabular-nums ${done ? "font-medium text-ok" : "text-ink-3"}`}>
                        {p.done}/{p.total}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          <Section title="Derniers résultats" action={<Link href={`${pub}?v=programme`} className="text-sm font-medium text-accent-ink hover:underline">Programme complet</Link>}>
            {recent.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                {recent.map((m) => (
                  <MatchRow key={m.id} m={m} v={v} href={`${pub}/match/${m.id}`} />
                ))}
              </div>
            ) : (
              <Empty>Les résultats apparaîtront ici dès le premier score validé.</Empty>
            )}
          </Section>
        </div>

        <aside className="xl:sticky xl:top-6">
          <InsightsPanel insights={insights} />
        </aside>
      </div>
    </Page>
  );
}

function Kpi({ label, icon, tone, children }: { label: string; icon: React.ReactNode; tone?: "live" | "warn"; children: React.ReactNode }) {
  return (
    <div className={`card space-y-2 p-4 ${tone === "live" ? "border-live/30" : tone === "warn" ? "border-warn/40 bg-warn-soft/40" : ""}`}>
      <div className={`flex items-center gap-1.5 text-xs font-medium ${tone === "live" ? "text-live" : tone === "warn" ? "text-warn" : "text-ink-3"}`}>
        {tone === "live" ? <span className="live-dot size-2 rounded-full bg-live" /> : icon}
        {label}
      </div>
      {children}
    </div>
  );
}
