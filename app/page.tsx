import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { Commands } from "@/components/CommandPalette";
import { SubmitButton } from "@/components/feedback";
import { IconLogout, IconPlus, IconSettings, IconTrophy, IconWhistle } from "@/components/Icons";
import { JoinForm, MyTournaments } from "@/components/Participant";
import { TournamentCard } from "@/components/TournamentCard";
import { DeleteAllButton, DeleteTournamentButton, DemoButton } from "@/components/TournamentActions";
import { Empty, Footer, Page, PageHeader, Section, TopBar } from "@/components/TopBar";
import { homeCommands } from "@/lib/commands";
import { isOrganizer } from "@/lib/server/auth";
import { listTournaments, tournamentStats, type TournamentStats } from "@/lib/server/data";
import { isConfigured } from "@/lib/server/db";
import type { Tournament } from "@/lib/types";
import { FORMAT_LABEL } from "@/lib/view";

export const dynamic = "force-dynamic";

const localDay = (tz: string) => new Date().toLocaleDateString("en-CA", { timeZone: tz });

export default async function Home() {
  if (!isConfigured()) return <SetupNeeded />;
  const org = await isOrganizer();
  if (!org) return <Visitor />;

  const [tournaments, stats] = await Promise.all([listTournaments(), tournamentStats()]);
  const today = tournaments.filter((t) => t.date === localDay(t.timezone));
  const upcoming = tournaments.filter((t) => t.date > localDay(t.timezone)).reverse();
  const past = tournaments.filter((t) => t.date < localDay(t.timezone));

  return (
    <>
      <Commands groups={homeCommands(tournaments, { org })} />
      <TopBar
        brand
        right={
          <form action={logoutAction}>
            <SubmitButton className="btn-quiet h-9 gap-1.5 px-2.5 text-sm" title="Se déconnecter" pendingLabel="Déconnexion…">
              <IconLogout className="size-4" />
              <span className="hidden sm:inline">Se déconnecter</span>
            </SubmitButton>
          </form>
        }
      />
      <Page>
        <PageHeader
          title="Mes tournois"
          description="Ouvrez un tournoi pour suivre les matchs, saisir les scores et gérer le planning."
          actions={
            <Link href="/nouveau" className="btn-accent">
              <IconPlus className="size-4" /> Créer un tournoi
            </Link>
          }
        />

        {tournaments.length === 0 ? (
          <Empty icon={<IconTrophy className="size-5" />}>
            <p className="text-lg font-semibold text-ink">Aucun tournoi pour l&apos;instant</p>
            <p className="mt-1">Créez votre premier tournoi, ou essayez l&apos;application avec deux tournois d&apos;exemple.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link href="/nouveau" className="btn-accent">
                <IconPlus className="size-4" /> Créer un tournoi
              </Link>
              <DemoButton />
            </div>
          </Empty>
        ) : (
          <>
            {today.length > 0 && (
              <Section title="Aujourd'hui" count={today.length}>
                <div className="grid gap-4 md:grid-cols-2">
                  {today.map((t) => (
                    <OrgCard key={t.id} t={t} s={stats.get(t.id)} featured />
                  ))}
                </div>
              </Section>
            )}
            {upcoming.length > 0 && (
              <Section title="À venir" count={upcoming.length}>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {upcoming.map((t) => (
                    <OrgCard key={t.id} t={t} s={stats.get(t.id)} />
                  ))}
                </div>
              </Section>
            )}
            {past.length > 0 && (
              <Section title="Terminés" hint="Les résultats et les classements restent consultables." count={past.length}>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {past.map((t) => (
                    <OrgCard key={t.id} t={t} s={stats.get(t.id)} muted />
                  ))}
                </div>
              </Section>
            )}
          </>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Link href="/sports" className="btn-quiet h-9 px-3 text-sm">
            <IconSettings className="size-4" /> Sports et règles
          </Link>
          {tournaments.length > 0 && <DemoButton />}
          {tournaments.length > 0 && (
            <span className="ml-auto">
              <DeleteAllButton count={tournaments.length} />
            </span>
          )}
        </div>
      </Page>
      <Footer />
    </>
  );
}

/** Accueil d'un participant ou d'un spectateur : rejoindre un tournoi, retrouver ceux déjà rejoints. */
function Visitor() {
  return (
    <>
      <Commands groups={homeCommands([], { org: false })} />
      <TopBar
        brand
        right={
          <Link href="/login" className="btn-quiet h-9 px-3 text-sm">
            Organisateur
          </Link>
        }
      />
      <Page narrow>
        <div className="space-y-2">
          <h1 className="display text-[30px] sm:text-[36px]">Suivre un tournoi</h1>
          <p className="text-[16px] leading-relaxed text-ink-2">
            Entrez le nom du tournoi et le code donnés par l&apos;organisateur : matchs, scores et classements en direct.
          </p>
        </div>
        <div id="rejoindre" className="card p-5">
          <JoinForm />
        </div>
        <Section title="Mes tournois" hint="Les tournois rejoints sur cet appareil.">
          <MyTournaments />
        </Section>
      </Page>
      <Footer />
    </>
  );
}

function OrgCard({ t, s, featured, muted }: { t: Tournament; s?: TournamentStats; featured?: boolean; muted?: boolean }) {
  return (
    <TournamentCard
      slug={t.slug}
      href={`/t/${t.slug}/admin`}
      name={t.name}
      sport={t.sport_name}
      date={t.date}
      subtitle={FORMAT_LABEL[t.format]}
      live={s?.live}
      done={s?.done}
      total={s?.total}
      featured={featured}
      muted={muted}
      footer={
        <>
          <Link href={`/t/${t.slug}/arbitre`} className="btn-quiet h-9 px-2.5 text-[14px]">
            <IconWhistle className="size-4" /> Saisir les scores
          </Link>
          <span className="ml-auto">
            <DeleteTournamentButton id={t.id} name={t.name} variant="icon" />
          </span>
        </>
      }
    />
  );
}

function SetupNeeded() {
  return (
    <>
      <TopBar brand />
      <Page narrow>
        <div className="card space-y-3 p-6">
          <h1 className="display text-[28px]">Configuration requise</h1>
          <p className="text-[15px] leading-relaxed text-ink-2">
            Copiez <code className="rounded bg-surface-2 px-1 font-mono text-sm">.env.example</code> vers{" "}
            <code className="rounded bg-surface-2 px-1 font-mono text-sm">.env</code>, renseignez le mot de passe organisateur et le secret de session, puis relancez le serveur.
            La base SQLite se crée toute seule dans <code className="rounded bg-surface-2 px-1 font-mono text-sm">DATA_DIR</code>.
          </p>
        </div>
      </Page>
      <Footer />
    </>
  );
}
