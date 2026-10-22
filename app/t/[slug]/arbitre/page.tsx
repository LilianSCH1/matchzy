import Link from "next/link";
import { refereeLogoutAction } from "@/app/actions";
import { IconLogout, IconWhistle } from "@/components/Icons";
import { LiveRefresh } from "@/components/LiveRefresh";
import { RefereeLoginForm } from "@/components/LoginForm";
import { MatchRow, Scoreboard } from "@/components/MatchRow";
import { Empty, LedBar, Page, Section, TopBar } from "@/components/TopBar";
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
        <TopBar title="Arbitrage" subtitle={t.name} back={base} />
        <Page narrow>
          <div className="rise mx-auto max-w-sm space-y-8 pt-8">
            <div className="space-y-3 text-center">
              <span className="mx-auto grid size-16 -rotate-6 place-items-center rounded-[10px] bg-accent text-on-accent shadow-[inset_0_-4px_0_rgb(0_0_0/0.25)]">
                <IconWhistle className="size-7" />
              </span>
              <p className="eyebrow text-accent-ink">{t.name}</p>
              <h1 className="display text-[52px]">Table de marque</h1>
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
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3.5 font-cond text-[14px] font-bold tracking-[0.06em] uppercase transition ${
                  c.courtId === courtId ? "bg-ink text-canvas shadow-[inset_0_-2px_0_rgb(0_0_0/0.35)]" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
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
        <div className="board flex items-center gap-4 rounded-[10px] p-4">
          <div className="shrink-0 text-center">
            <span className="led text-[40px] leading-none">{done.length}</span>
            <span className="font-cond text-lg font-bold text-[#858074]">/{matches.length}</span>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="font-cond text-[13px] font-bold tracking-[0.12em] text-[#f3efe4] uppercase">Matchs joués</div>
            <LedBar value={done.length} total={matches.length} cells={16} tone={pct === 100 ? "ok" : "led"} className="text-white" />
            <div className="text-xs text-[#b4afa3]">
              {status?.state === "late"
                ? `Retard de ${status.delay} min sur ce ${L.court}`
                : todo.length
                  ? `${todo.length} match${todo.length > 1 ? "s" : ""} restant${todo.length > 1 ? "s" : ""}`
                  : "Journée terminée, merci !"}
            </div>
          </div>
          {status?.state === "late" && <span className="chip bg-[#ffd23f] text-[#15130e] tabular-nums">+{status.delay} min</span>}
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
