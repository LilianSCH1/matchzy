import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { Commands, SearchButton } from "@/components/CommandPalette";
import { SubmitButton } from "@/components/feedback";
import { IconArrowRight, IconLogout, IconPlus, IconSettings, IconTrophy, IconWhistle } from "@/components/Icons";
import { DeleteAllButton, DeleteTournamentButton, DemoButton } from "@/components/TournamentActions";
import { Empty, Page, Section, TopBar } from "@/components/TopBar";
import { homeCommands } from "@/lib/commands";
import { isOrganizer } from "@/lib/server/auth";
import { listTournaments, tournamentStats, type TournamentStats } from "@/lib/server/data";
import { isConfigured } from "@/lib/server/db";
import type { Tournament } from "@/lib/types";
import { fmtDate, FORMAT_LABEL } from "@/lib/view";

export const dynamic = "force-dynamic";

const localDay = (tz: string) => new Date().toLocaleDateString("en-CA", { timeZone: tz });

export default async function Home() {
  if (!isConfigured()) return <SetupNeeded />;
  const [org, tournaments, stats] = await Promise.all([isOrganizer(), listTournaments(), tournamentStats()]);
  const today = tournaments.filter((t) => t.date === localDay(t.timezone));
  const upcoming = tournaments.filter((t) => t.date > localDay(t.timezone)).reverse();
  const past = tournaments.filter((t) => t.date < localDay(t.timezone));
  const liveTotal = today.reduce((n, t) => n + (stats.get(t.id)?.live ?? 0), 0);

  return (
    <>
      <Commands groups={homeCommands(tournaments, { org })} />
      <TopBar
        brand
        right={
          org ? (
            <form action={logoutAction}>
              <SubmitButton className="btn-quiet h-9 gap-1.5 px-2.5 text-sm" title="Se déconnecter" pendingLabel="Déconnexion…">
                <IconLogout className="size-4" />
                <span className="hidden sm:inline">Déconnexion</span>
              </SubmitButton>
            </form>
          ) : (
            <Link href="/login" className="btn-outline h-9 px-3.5 text-sm">
              Organisateur
            </Link>
          )
        }
      />
      <Page>
        <div className="rise grid items-end gap-6 pt-2 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            {liveTotal > 0 && (
              <span className="chip bg-live-soft text-live">
                <span className="live-dot size-1.5 rounded-full bg-live" /> {liveTotal} match{liveTotal > 1 ? "s" : ""} en direct en ce moment
              </span>
            )}
            <h1 className="text-4xl font-semibold tracking-[-0.04em] text-balance sm:text-6xl">
              {org ? (
                <>
                  Vos tournois,
                  <br />
                  <span className="text-ink-3">sous contrôle.</span>
                </>
              ) : (
                <>
                  Le tournoi,
                  <br />
                  <span className="text-ink-3">en direct.</span>
                </>
              )}
            </h1>
            <p className="max-w-md text-[15px] leading-relaxed text-ink-2">
              {org
                ? "Planning, scores au bord du terrain et phase finale automatique. L'assistant repère les retards et les conflits à votre place."
                : "Scores au bord du terrain, classements et phase finale mis à jour à chaque point."}
            </p>
          </div>
          <div className="space-y-2">
            <SearchButton className="h-11 text-[15px]" />
            {org && (
              <div className="flex gap-2">
                <Link href="/nouveau" className="btn-accent flex-1">
                  <IconPlus className="size-4" /> Nouveau tournoi
                </Link>
                <Link href="/sports" className="btn-outline px-3" title="Sports & règles" aria-label="Sports & règles">
                  <IconSettings className="size-4" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {tournaments.length === 0 ? (
          <Empty icon={<IconTrophy className="size-5" />}>
            <p>Aucun tournoi pour l&apos;instant.</p>
            {org ? (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Link href="/nouveau" className="btn-accent h-10 text-sm">
                  <IconPlus className="size-4" /> Créer un tournoi
                </Link>
                <DemoButton />
              </div>
            ) : (
              <p className="mt-1">
                <Link href="/login" className="font-medium text-accent-ink underline underline-offset-4">
                  Connectez-vous
                </Link>{" "}
                pour en créer un.
              </p>
            )}
          </Empty>
        ) : (
          <>
            {today.length > 0 && (
              <Section title="Aujourd'hui" count={today.length}>
                <div className="grid gap-3 md:grid-cols-2">
                  {today.map((t) => (
                    <Card key={t.id} t={t} s={stats.get(t.id)} org={org} featured />
                  ))}
                </div>
              </Section>
            )}
            {upcoming.length > 0 && (
              <Section title="À venir" count={upcoming.length}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {upcoming.map((t) => (
                    <Card key={t.id} t={t} s={stats.get(t.id)} org={org} />
                  ))}
                </div>
              </Section>
            )}
            {past.length > 0 && (
              <Section title="Terminés" count={past.length}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {past.map((t) => (
                    <Card key={t.id} t={t} s={stats.get(t.id)} org={org} muted />
                  ))}
                </div>
              </Section>
            )}
            {org && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
                <DemoButton />
                <DeleteAllButton count={tournaments.length} />
              </div>
            )}
          </>
        )}
      </Page>
    </>
  );
}

function Card({ t, s, org, featured, muted }: { t: Tournament; s?: TournamentStats; org: boolean; featured?: boolean; muted?: boolean }) {
  const pct = s?.total ? Math.round((100 * s.done) / s.total) : 0;
  const finished = !!s?.total && s.done === s.total;
  return (
    <article className={`card group relative flex flex-col overflow-hidden transition hover:border-line-strong hover:shadow-float ${s?.live ? "border-live/30" : ""}`}>
      <div className={`flex flex-1 flex-col gap-4 ${featured ? "p-5" : "p-4"}`}>
        <div className="flex items-center gap-2">
          <span className="chip bg-surface-2 text-ink-2">{t.sport_name}</span>
          {s?.live ? (
            <span className="chip bg-live-soft text-live">
              <span className="live-dot size-1.5 rounded-full bg-live" /> {s.live} en cours
            </span>
          ) : finished ? (
            <span className="chip bg-ok-soft text-ok">Terminé</span>
          ) : null}
          <IconArrowRight className="ml-auto size-4 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-ink" />
        </div>
        <div className="min-w-0 flex-1">
          <Link href={`/t/${t.slug}`} className="after:absolute after:inset-0">
            <h3 className={`truncate font-semibold tracking-tight ${featured ? "text-2xl" : "text-lg"} ${muted ? "text-ink-2" : ""}`}>{t.name}</h3>
          </Link>
          <p className="mt-1 truncate text-sm text-ink-3 first-letter:uppercase">
            {fmtDate(t.date)} · {FORMAT_LABEL[t.format]}
          </p>
        </div>
        {s && s.total > 0 && (s.done > 0 || featured) && (
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div className={`h-full rounded-full ${finished ? "bg-ok" : "bg-accent"}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-ink-3 tabular-nums">
              {s.done}/{s.total}
            </span>
          </div>
        )}
      </div>
      <div className="relative z-10 flex items-center gap-1 border-t border-line bg-surface-2/40 px-2 py-1.5">
        <Link href={`/t/${t.slug}/arbitre`} className="btn-quiet h-8 rounded-lg px-2.5 text-[13px]">
          <IconWhistle className="size-4" /> Arbitrer
        </Link>
        {org && (
          <Link href={`/t/${t.slug}/admin`} className="btn-quiet h-8 rounded-lg px-2.5 text-[13px]">
            <IconSettings className="size-4" /> Organiser
          </Link>
        )}
        {org && (
          <span className="ml-auto">
            <DeleteTournamentButton id={t.id} name={t.name} variant="icon" />
          </span>
        )}
      </div>
    </article>
  );
}

function SetupNeeded() {
  return (
    <>
      <TopBar brand />
      <Page narrow>
        <div className="card space-y-3 p-6">
          <h1 className="text-xl font-semibold tracking-tight">Configuration requise</h1>
          <p className="text-[15px] leading-relaxed text-ink-2">
            Copiez <code className="rounded bg-surface-2 px-1 font-mono text-sm">.env.example</code> vers{" "}
            <code className="rounded bg-surface-2 px-1 font-mono text-sm">.env</code>, renseignez <code className="rounded bg-surface-2 px-1 font-mono text-sm">DATABASE_URL</code>{" "}
            (Neon), le mot de passe organisateur et le secret de session, lancez <code className="rounded bg-surface-2 px-1 font-mono text-sm">npm run db:migrate</code> puis relancez le
            serveur.
          </p>
        </div>
      </Page>
    </>
  );
}
