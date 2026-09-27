import Link from "next/link";
import { refereeLogoutAction } from "@/app/actions";
import { IconLogout, IconWhistle } from "@/components/Icons";
import { LiveRefresh } from "@/components/LiveRefresh";
import { RefereeLoginForm } from "@/components/LoginForm";
import { MatchRow } from "@/components/MatchRow";
import { Empty, Page, Section, TopBar } from "@/components/TopBar";
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
          <div className="rise mx-auto max-w-sm space-y-6 pt-10">
            <div className="space-y-3 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent text-on-accent">
                <IconWhistle className="size-5" />
              </span>
              <h1 className="text-2xl font-semibold tracking-tight">Espace arbitre</h1>
              <p className="text-sm text-ink-2">Entrez le code à 6 chiffres communiqué par l&apos;organisateur.</p>
            </div>
            <RefereeLoginForm slug={t.slug} courtLabel={L.court} />
          </div>
        </Page>
      </>
    );
  }

  const v = new View(b);
  const matches = v.playable().filter((m) => m.court_id === courtId).sort(byTime);
  const todo = matches.filter((m) => m.status !== "finished");
  const done = matches.filter((m) => m.status === "finished").reverse();
  const logout = refereeLogoutAction.bind(null, t.slug, t.id);
  const [current, ...later] = todo;

  return (
    <>
      <LiveRefresh />
      <TopBar
        title={v.courts.get(courtId) ?? L.court}
        subtitle={`${t.name} · arbitrage`}
        back={base}
        right={
          !org && (
            <form action={logout}>
              <button className="btn-quiet h-9 gap-1.5 px-3 text-sm">
                <IconLogout className="size-4" /> Quitter
              </button>
            </form>
          )
        }
      />
      {org && b.courts.length > 1 && (
        <nav className="sticky top-14 z-20 border-b border-line bg-canvas/85 backdrop-blur-xl">
          <div className="no-scrollbar mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 py-2 sm:px-5">
            {b.courts.map((c) => (
              <Link
                key={c.id}
                href={`${base}/arbitre?terrain=${c.id}`}
                className={`inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium transition ${
                  c.id === courtId ? "bg-ink text-canvas" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {c.name}
              </Link>
            ))}
          </div>
        </nav>
      )}
      <Page narrow>
        {current ? (
          <Section title={current.status === "live" ? "Match en cours" : "Prochain match"}>
            <MatchRow m={current} v={v} href={`${base}/match/${current.id}`} showCourt={false} big />
          </Section>
        ) : (
          <Empty>Tous les matchs de ce {L.court} sont terminés.</Empty>
        )}
        {later.length > 0 && (
          <Section title="Ensuite">
            <div className="space-y-2">
              {later.map((m) => (
                <MatchRow key={m.id} m={m} v={v} href={`${base}/match/${m.id}`} showCourt={false} />
              ))}
            </div>
          </Section>
        )}
        {done.length > 0 && (
          <Section title="Terminés" hint="Touchez un match pour corriger son score.">
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
