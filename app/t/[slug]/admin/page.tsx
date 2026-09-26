import Link from "next/link";
import { IconArrowRight, IconCheck, IconEye, IconScreen, IconWhistle } from "@/components/Icons";
import { MatchRow } from "@/components/MatchRow";
import { ShiftButton } from "@/components/ShiftButton";
import { Empty, Notice, Page, Section } from "@/components/TopBar";
import { estimatedEnd } from "@/lib/build";
import { resolveTournament } from "@/lib/resolve";
import { bundleOr404 } from "@/lib/server/page";
import { byTime, fmtTime, View } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function Dashboard({ params }: { params: Promise<{ slug: string }> }) {
  const b = await bundleOr404((await params).slug);
  const v = new View(b);
  const t = b.tournament;
  const L = t.rules.labels;
  const base = `/t/${t.slug}`;
  const all = v.playable();
  const done = all.filter((m) => m.status === "finished").length;
  const live = v.live().sort(byTime);
  const r = resolveTournament(b);
  const poolTotal = all.filter((m) => m.phase === "pool").length;
  const poolDone = all.filter((m) => m.phase === "pool" && m.status === "finished").length;
  const end = estimatedEnd(b);
  const now = Date.now();
  const late = all.filter((m) => v.delay(m, now) > 0);
  const withdrawn = b.teams.filter((x) => x.withdrawn);
  const pct = all.length ? Math.round((100 * done) / all.length) : 0;

  // Retard projeté : fin prévue du dernier match + plus grand retard actuel
  const maxDelay = Math.max(
    0,
    ...b.courts.map((c) => {
      const next = all.filter((m) => m.court_id === c.id && m.status === "scheduled").sort(byTime)[0];
      return next ? v.delay(next, now) : 0;
    }),
  );

  return (
    <Page>
      <div className="card overflow-hidden">
        <div className="grid grid-cols-2 gap-px bg-line md:grid-cols-4">
          <Stat label="Matchs joués" value={`${done}`} unit={`/ ${all.length}`} />
          <Stat label="En cours" value={String(live.length)} tone={live.length ? "live" : undefined} />
          <Stat label="En retard" value={String(late.length)} unit={late.length ? `max ${maxDelay} min` : undefined} tone={late.length ? "warn" : undefined} />
          <Stat label="Fin estimée" value={end ? fmtTime(new Date(end.getTime() + maxDelay * 60000).toISOString(), t.timezone) : "–"} />
        </div>
        <div className="flex items-center gap-3 border-t border-line px-5 py-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-ink transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-medium text-ink-2 tabular-nums">{pct} %</span>
        </div>
      </div>

      {(t.format === "pools_knockout" || withdrawn.length > 0) && (
        <div className="space-y-2">
          {t.format === "pools_knockout" &&
            (r.poolsComplete ? (
              <Notice tone="ok">
                <span className="flex items-center gap-2">
                  <IconCheck className="size-4" /> Poules terminées : la phase finale a été remplie automatiquement.
                </span>
              </Notice>
            ) : (
              <Notice>
                Poules : {poolDone}/{poolTotal} matchs joués. La phase finale se remplira automatiquement à la fin des poules.
              </Notice>
            ))}
          {withdrawn.length > 0 && <Notice tone="warn">Abandon : {withdrawn.map((x) => x.name).join(", ")} (matchs restants perdus par forfait).</Notice>}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        <Shortcut href={`${base}/arbitre`} icon={<IconWhistle />} title="Saisir les scores" sub={`Par ${L.court}`} />
        <Shortcut href={base} icon={<IconEye />} title="Vue publique" sub="Ce que voient les joueurs" />
        <Shortcut href={`${base}/ecran`} icon={<IconScreen />} title="Écran géant" sub="À projeter sur place" />
      </div>

      <Section title="En cours">
        {live.length ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {live.map((m) => (
              <MatchRow key={m.id} m={m} v={v} href={`${base}/match/${m.id}`} />
            ))}
          </div>
        ) : (
          <Empty>Aucun match en cours.</Empty>
        )}
      </Section>

      <Section title={`Prochains matchs par ${L.court}`} hint={`« +5 min » repousse le prochain match et tous les suivants du ${L.court}.`}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {v.nextByCourt(3).map(({ courtId, matches }) => {
            const first = matches[0];
            const delay = first ? v.delay(first, now) : 0;
            return (
              <div key={courtId} className="space-y-2">
                <div className="flex h-9 items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="eyebrow">{v.courts.get(courtId)}</span>
                    {delay > 0 && <span className="chip bg-warn-soft text-warn">retard {delay} min</span>}
                  </span>
                  {first && <ShiftButton matchId={first.id} courtId={courtId} scheduledAt={first.scheduled_at!} minutes={5} />}
                </div>
                {matches.length ? (
                  matches.map((m) => <MatchRow key={m.id} m={m} v={v} href={`${base}/match/${m.id}`} showCourt={false} />)
                ) : (
                  <Empty>Plus de match prévu.</Empty>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </Page>
  );
}

function Stat({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: "live" | "warn" }) {
  return (
    <div className="bg-surface px-5 py-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={`text-3xl font-semibold tracking-tight tabular-nums ${tone === "live" ? "text-live" : tone === "warn" ? "text-warn" : ""}`}>{value}</span>
        {unit && <span className="text-sm text-ink-3">{unit}</span>}
      </div>
    </div>
  );
}

function Shortcut({ href, icon, title, sub }: { href: string; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <Link href={href} className="card group flex items-center gap-3 p-4 transition hover:border-line-strong">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-ink-3">{sub}</span>
      </span>
      <IconArrowRight className="size-4 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-ink" />
    </Link>
  );
}
