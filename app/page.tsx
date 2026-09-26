import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { SubmitButton } from "@/components/feedback";
import { IconArrowRight, IconLogout, IconPlus, IconSettings, IconWhistle } from "@/components/Icons";
import { DeleteAllButton, DeleteTournamentButton, DemoButton } from "@/components/TournamentActions";
import { Empty, Page, Section, TopBar } from "@/components/TopBar";
import { isOrganizer } from "@/lib/server/auth";
import { listTournaments } from "@/lib/server/data";
import { isConfigured } from "@/lib/server/db";
import type { Tournament } from "@/lib/types";
import { fmtDate, FORMAT_LABEL } from "@/lib/view";

export const dynamic = "force-dynamic";

const localDay = (tz: string) => new Date().toLocaleDateString("en-CA", { timeZone: tz });

export default async function Home() {
  if (!isConfigured()) return <SetupNeeded />;
  const [org, tournaments] = await Promise.all([isOrganizer(), listTournaments()]);
  const upcoming = tournaments.filter((t) => t.date >= localDay(t.timezone)).reverse();
  const past = tournaments.filter((t) => t.date < localDay(t.timezone));
  return (
    <>
      <TopBar
        brand
        right={
          org ? (
            <form action={logoutAction}>
              <SubmitButton className="btn-quiet h-9 gap-1.5 px-3 text-sm" title="Se déconnecter" pendingLabel="Déconnexion…">
                <IconLogout className="size-4" />
                <span className="hidden sm:inline">Déconnexion</span>
              </SubmitButton>
            </form>
          ) : (
            <Link href="/login" className="btn-outline h-9 px-4 text-sm">
              Espace organisateur
            </Link>
          )
        }
      />
      <Page>
        <div className="rise space-y-5 pt-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
              Le tournoi,
              <br />
              <span className="text-ink-3">en direct.</span>
            </h1>
            <p className="max-w-md text-[15px] text-ink-2">Scores au bord du terrain, classements et phase finale mis à jour à chaque point.</p>
          </div>
          {org && (
            <div className="flex flex-wrap gap-2">
              <Link href="/nouveau" className="btn-primary">
                <IconPlus className="size-4" /> Nouveau tournoi
              </Link>
              <Link href="/sports" className="btn-outline">
                <IconSettings className="size-4" /> Sports &amp; règles
              </Link>
              <DemoButton />
            </div>
          )}
        </div>

        {tournaments.length === 0 ? (
          <Empty>
            Aucun tournoi pour l&apos;instant.
            {org && " Créez le vôtre, ou lancez la démo pour découvrir l'application avec des matchs en cours."}
            {!org && (
              <>
                {" "}
                <Link href="/login" className="font-medium text-ink underline underline-offset-4">
                  Connectez-vous
                </Link>{" "}
                pour en créer un.
              </>
            )}
          </Empty>
        ) : (
          <>
            {upcoming.length > 0 && (
              <Section title="Aujourd'hui et à venir">
                <Grid list={upcoming} org={org} />
              </Section>
            )}
            {past.length > 0 && (
              <Section title="Terminés">
                <Grid list={past} org={org} muted />
              </Section>
            )}
            {org && (
              <div className="flex justify-end border-t border-line pt-4">
                <DeleteAllButton count={tournaments.length} />
              </div>
            )}
          </>
        )}
      </Page>
    </>
  );
}

function Grid({ list, org, muted }: { list: Tournament[]; org: boolean; muted?: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {list.map((t) => {
        const today = t.date === localDay(t.timezone);
        return (
          <article key={t.id} className="card group relative flex flex-col gap-4 p-5 transition hover:border-line-strong">
            <div className="flex items-center gap-2">
              <span className="chip bg-surface-2 text-ink-2">{t.sport_name}</span>
              {today && (
                <span className="chip bg-accent text-on-accent">
                  <span className="live-dot size-1.5 rounded-full bg-on-accent" /> Aujourd&apos;hui
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/t/${t.slug}`} className="after:absolute after:inset-0 after:rounded-2xl">
                <h3 className={`truncate text-xl font-semibold tracking-tight ${muted ? "text-ink-2" : ""}`}>{t.name}</h3>
              </Link>
              <p className="mt-1 text-sm text-ink-3 first-letter:uppercase">
                {fmtDate(t.date)} · {FORMAT_LABEL[t.format]}
              </p>
            </div>
            <div className="flex items-center gap-1 border-t border-line pt-3">
              <Link href={`/t/${t.slug}/arbitre`} className="btn-quiet relative z-10 -ml-3 h-9 px-3 text-sm">
                <IconWhistle className="size-4" /> Arbitrer
              </Link>
              {org && (
                <Link href={`/t/${t.slug}/admin`} className="btn-quiet relative z-10 h-9 px-3 text-sm">
                  <IconSettings className="size-4" /> Organiser
                </Link>
              )}
              <span className="ml-auto flex items-center gap-1">
                {org && <DeleteTournamentButton id={t.id} name={t.name} variant="icon" />}
                <IconArrowRight className="size-4 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-ink" />
              </span>
            </div>
          </article>
        );
      })}
    </div>
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
