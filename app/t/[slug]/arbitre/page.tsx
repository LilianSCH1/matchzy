import Link from "next/link";
import { refereeLogoutAction } from "@/app/actions";
import { IconLogout, IconWhistle } from "@/components/Icons";
import { LiveRefresh } from "@/components/LiveRefresh";
import { RefereeLoginForm } from "@/components/LoginForm";
import { MatchRow, Scoreboard } from "@/components/MatchRow";
import { Empty, Page, Section, TopBar } from "@/components/TopBar";
import { courtStatuses } from "@/lib/insights";
import { isOrganizer, refereeCourt } from "@/lib/server/auth";
import { bundleOr404 } from "@/lib/server/page";
import { byTime, View } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function RefereePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ terrain?: string }> }) {
  const { slug } = await params;
  const { terrain } = await searchParams;
  const b = await bundleOr404(slug);
  const t = b.tournament;
  const L = t.rules.labels;
  const org = await isOrganizer();
  const refCourt = await refereeCourt(t.id);
  const courtId = org ? (terrain ?? refCourt ?? b.courts[0]?.id) : refCourt;
  const base = `/t/${t.slug}`;

  if (!courtId) {
    return (
      <>
        <TopBar title="Espace arbitre" subtitle={t.name} back={base} />
        <Page narrow>
          <div className="mx-auto max-w-sm space-y-6 pt-6">
            <div className="space-y-2">
              <h1 className="display text-[30px]">Saisir les scores</h1>
              <p className="text-sm leading-relaxed text-ink-2">
                Entrez le code à 6 chiffres de votre {L.court}, communiqué par l&apos;organisateur. Vous verrez ensuite vos matchs dans l&apos;ordre.
              </p>
            </div>
            <div className="card p-4">
              <RefereeLoginForm slug={t.slug} courtLabel={L.court} />
            </div>
          </div>
        </Page>
      </>
    );
  }

  const v = new View(b);
  const now = Date.now();
  const statuses = courtStatuses(b, now);
  const status = statuses.find((c) => c.courtId === courtId);
  const matches = v
    .playable()
    .filter((m) => m.court_id === courtId)
    .sort(byTime);
  const todo = matches.filter((m) => m.status !== "finished");
  const done = matches.filter((m) => m.status === "finished").reverse();
  const logout = refereeLogoutAction.bind(null, t.slug, t.id);
  const [current, ...later] = todo;
  const pct = matches.length ? (100 * done.length) / matches.length : 0;

  return (
    <>
      <LiveRefresh />
      <TopBar
        title={v.courts.get(courtId) ?? L.court}
        subtitle={`${t.name} · arbitrage`}
        back={org ? `${base}/admin` : base}
        right={
          !org && (
            <form action={logout}>
              <button className="btn-quiet h-9 gap-1.5 px-2.5 text-sm">
                <IconLogout className="size-4" /> <span className="hidden sm:inline">Quitter</span>
              </button>
            </form>
          )
        }
      />
      {org && b.courts.length > 1 && (
        <nav className="sticky top-14 z-20 border-b border-line bg-canvas/80 backdrop-blur-xl" aria-label={L.courtPlural}>
          <div className="no-scrollbar mx-auto flex max-w-xl gap-1 overflow-x-auto px-3 py-2 sm:px-5">
            {statuses.map((c) => (
              <Link
                key={c.courtId}
                href={`${base}/arbitre?terrain=${c.courtId}`}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3.5 text-[14px] font-bold transition ${
                  c.courtId === courtId ? "bg-ink text-canvas" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {c.live && <span className="live-dot size-1.5 rounded-full bg-live" />}
                {c.name}
                {c.state === "late" && <span className="size-1.5 rounded-full bg-warn" title={`Retard ${c.delay} min`} />}
              </Link>
            ))}
          </div>
        </nav>
      )}
      <Page narrow>
        <div className="card flex items-center gap-4 p-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[15px] font-semibold">Matchs joués</span>
              <span className="text-[15px] font-semibold tabular-nums">
                {done.length} / {matches.length}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div className={`h-full rounded-full ${pct === 100 ? "bg-ok" : "bg-accent"}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="text-[13px] text-ink-2">
              {status?.state === "late"
                ? `Retard de ${status.delay} min sur ce ${L.court}`
                : todo.length
                  ? `${todo.length} match${todo.length > 1 ? "s" : ""} restant${todo.length > 1 ? "s" : ""}`
                  : "Journée terminée, merci !"}
            </div>
          </div>
        </div>

        {current ? (
          <Section title={current.status === "live" ? "Match en cours" : "Prochain match"}>
            <Scoreboard
              m={current}
              v={v}
              href={`${base}/match/${current.id}`}
              now={now}
              size="lg"
              cta={current.status === "live" ? "Saisir le score" : "Démarrer le match"}
            />
          </Section>
        ) : (
          <Empty icon={<IconWhistle className="size-5" />}>Tous les matchs de ce {L.court} sont terminés.</Empty>
        )}
        {later.length > 0 && (
          <Section title="Ensuite" count={later.length}>
            <div className="space-y-2">
              {later.map((m) => (
                <MatchRow key={m.id} m={m} v={v} href={`${base}/match/${m.id}`} showCourt={false} />
              ))}
            </div>
          </Section>
        )}
        {done.length > 0 && (
          <Section title="Terminés" hint="Touchez un match pour corriger son score." count={done.length}>
            <div className="space-y-2">
              {done.map((m) => (
                <MatchRow key={m.id} m={m} v={v} href={`${base}/match/${m.id}`} showCourt={false} />
              ))}
            </div>
          </Section>
        )}
      </Page>
    </>
  );
}
