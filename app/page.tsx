import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { Commands, SearchButton } from "@/components/CommandPalette";
import { SubmitButton } from "@/components/feedback";
import { IconDown, IconLogout, IconPlus, IconSettings, IconTicket, IconTrophy, IconWhistle } from "@/components/Icons";
import { JoinForm, MyTournaments } from "@/components/Participant";
import { TournamentCard } from "@/components/TournamentCard";
import { CourtLines, Led, SportGlyph, type SportKey } from "@/components/Stadium";
import { DeleteAllButton, DeleteTournamentButton, DemoButton } from "@/components/TournamentActions";
import { Empty, Footer, Page, Section, TopBar } from "@/components/TopBar";
import { homeCommands } from "@/lib/commands";
import { isOrganizer } from "@/lib/server/auth";
import { listTournaments, tournamentStats, type TournamentStats } from "@/lib/server/data";
import { isConfigured } from "@/lib/server/db";
import type { Tournament } from "@/lib/types";
import { FORMAT_LABEL } from "@/lib/view";

export const dynamic = "force-dynamic";

const localDay = (tz: string) => new Date().toLocaleDateString("en-CA", { timeZone: tz });

const SPORTS: { key: SportKey; label: string }[] = [
  { key: "football", label: "Foot" },
  { key: "basketball", label: "Basket" },
  { key: "volleyball", label: "Volley" },
  { key: "handball", label: "Hand" },
  { key: "badminton", label: "Bad" },
  { key: "tennis-de-table", label: "Ping" },
  { key: "rugby", label: "Rugby" },
];

export default async function Home() {
  if (!isConfigured()) return <SetupNeeded />;
  const org = await isOrganizer();
  // Les participants ne voient que les tournois rejoints avec un code (liste gardée sur leur appareil).
  const [tournaments, stats] = org ? await Promise.all([listTournaments(), tournamentStats()]) : [[] as Tournament[], new Map<string, TournamentStats>()];
  const today = tournaments.filter((t) => t.date === localDay(t.timezone));
  const upcoming = tournaments.filter((t) => t.date > localDay(t.timezone)).reverse();
  const past = tournaments.filter((t) => t.date < localDay(t.timezone));
  const liveTotal = today.reduce((n, t) => n + (stats.get(t.id)?.live ?? 0), 0);
  const doneTotal = today.reduce((n, t) => n + (stats.get(t.id)?.done ?? 0), 0);

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

      {/* Affiche : le terrain la nuit, projecteurs allumés. */}
      {/* L'affiche occupe exactement le premier écran ; la liste commence en dessous. */}
      <section className="relative isolate flex min-h-[calc(100svh-3.5rem)] flex-col justify-center overflow-hidden border-b border-line">
        <NightPitch />
        <div className="mx-auto grid w-full max-w-5xl items-center gap-8 px-4 py-10 sm:px-5 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rise space-y-5">
            <p className="eyebrow flex flex-wrap items-center gap-2">
              {liveTotal > 0 ? (
                <span className="chip bg-live text-white">
                  <span className="live-dot size-1.5 rounded-full bg-white" /> En direct
                </span>
              ) : (
                <span className="chip bg-ink text-canvas">Jour de match</span>
              )}
              Tournois multisports, du coup d&apos;envoi à la finale
            </p>
            <h1 className="display text-[clamp(3.6rem,min(13vw,15svh),9rem)]">
              {org ? (
                <>
                  <span className="block">Votre</span>
                  <span className="block text-transparent [-webkit-text-stroke:2px_var(--accent)]">terrain.</span>
                </>
              ) : (
                <>
                  <span className="block">Coup</span>
                  <span className="block text-transparent [-webkit-text-stroke:2px_var(--accent)]">d&apos;envoi.</span>
                </>
              )}
            </h1>
            <p className="max-w-md text-[16px] leading-relaxed text-ink-2">
              {org
                ? "Poules, planning, scores au bord du terrain et phase finale automatique. L'assistant repère les retards et les conflits à votre place."
                : "Entrez le nom du tournoi et le code donnés par l'organisateur : scores, classements et tableau final en direct, à chaque point. Foot, basket, volley, hand et tous les autres."}
            </p>
            <ul className="flex flex-wrap gap-1.5" aria-label="Sports pris en charge">
              {SPORTS.map((s) => (
                <li key={s.key} data-sport={s.key} className="chip border border-line bg-surface/70 text-ink-2 backdrop-blur">
                  <SportGlyph sport={s.key} className="size-3.5 text-sport" />
                  {s.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="rise space-y-2" style={{ animationDelay: "120ms" }}>
            {org ? (
              <>
                {/* Tableau d'affichage du jour */}
                <div className="board overflow-hidden rounded-[10px] p-1">
                  <div className="flex items-center justify-between px-3 pt-2 font-cond text-[11px] font-extrabold tracking-[0.18em] text-[#b4afa3] uppercase">
                    <span>Aujourd&apos;hui</span>
                    <span className="flex items-center gap-1.5">
                      <span className={`size-1.5 rounded-full ${liveTotal ? "live-dot bg-[#ff4436]" : "bg-[#39444c]"}`} />
                      {liveTotal ? "Live" : "Repos"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-white/10 py-3 text-center">
                    <Stat label="Tournois" value={today.length} />
                    <Stat label="En jeu" value={liveTotal} color={liveTotal ? "#ff4436" : undefined} />
                    <Stat label="Joués" value={doneTotal} digits={3} />
                  </div>
                </div>
                <SearchButton className="h-11 text-[15px]" />
                <div className="flex gap-2">
                  <Link href="/nouveau" className="btn-accent flex-1">
                    <IconPlus className="size-4" /> Nouveau tournoi
                  </Link>
                  <Link href="/sports" className="btn-outline px-3" title="Sports & règles" aria-label="Sports & règles">
                    <IconSettings className="size-4" />
                  </Link>
                </div>
              </>
            ) : (
              <div id="rejoindre" className="card scroll-mt-20 overflow-hidden p-4 pt-0 shadow-pop">
                <div className="board -mx-4 mb-4 flex items-center gap-2 px-4 py-2.5">
                  <IconTicket className="size-5 text-led" />
                  <span className="display text-[22px] text-[#f3efe4]">Rejoindre un tournoi</span>
                </div>
                <JoinForm />
              </div>
            )}
          </div>
        </div>
        <a
          href="#suite"
          className="absolute bottom-4 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1 font-cond text-[12px] font-bold tracking-[0.18em] text-ink-3 uppercase transition hover:text-ink sm:flex"
        >
          {org ? "Vos tournois" : "Mes tournois"}
          <IconDown className="size-4 animate-bounce motion-reduce:animate-none" />
        </a>
      </section>

      <Page className="scroll-mt-14" id="suite">
        {!org ? (
          <Section title="Mes tournois" hint="Enregistrés sur cet appareil. Retirez ceux que vous ne suivez plus.">
            <MyTournaments />
          </Section>
        ) : tournaments.length === 0 ? (
          <Empty icon={<IconTrophy className="size-5" />}>
            <p className="display text-2xl text-ink">Terrain vide</p>
            <p className="mt-1">Aucun tournoi pour l&apos;instant.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link href="/nouveau" className="btn-accent h-10 text-sm">
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
              <Section title="Au calendrier" count={upcoming.length}>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {upcoming.map((t) => (
                    <OrgCard key={t.id} t={t} s={stats.get(t.id)} />
                  ))}
                </div>
              </Section>
            )}
            {past.length > 0 && (
              <Section title="Feuilles de match" hint="Tournois terminés : résultats et classements consultables." count={past.length}>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {past.map((t) => (
                    <OrgCard key={t.id} t={t} s={stats.get(t.id)} muted />
                  ))}
                </div>
              </Section>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
              <DemoButton />
              <DeleteAllButton count={tournaments.length} />
            </div>
          </>
        )}
      </Page>
      <Footer />
    </>
  );
}

function Stat({ label, value, color, digits = 2 }: { label: string; value: number; color?: string; digits?: number }) {
  return (
    <div className="space-y-1.5">
      <Led value={value} digits={digits} color={color} className="text-[40px]" />
      <div className="font-cond text-[11px] font-bold tracking-[0.14em] text-[#858074] uppercase">{label}</div>
    </div>
  );
}

/** Terrain en perspective, lignes à la craie, éclairé par deux projecteurs (décor de l'affiche). */
function NightPitch() {
  return (
    <div aria-hidden className="floodlight absolute inset-0 -z-10">
      <div className="absolute inset-x-0 bottom-0 h-[78%] [perspective:520px]">
        <div
          className="absolute -inset-x-1/4 bottom-[-35%] h-[150%] origin-bottom [transform:rotateX(62deg)] [mask-image:linear-gradient(to_top,#000_15%,transparent_85%)]"
          style={{
            background: "repeating-linear-gradient(90deg, color-mix(in oklab, var(--chalk) 5%, transparent) 0 9%, transparent 9% 18%)",
          }}
        >
          <CourtLines sport="football" className="absolute inset-0 h-full w-full text-chalk opacity-30" />
        </div>
      </div>
      {/* Faisceaux des projecteurs */}
      <div className="absolute -top-10 left-[8%] h-[120%] w-56 origin-top -rotate-[24deg] bg-[linear-gradient(180deg,rgb(255_247_222/0.16),transparent_75%)] blur-2xl" />
      <div className="absolute -top-10 right-[8%] h-[120%] w-56 origin-top rotate-[24deg] bg-[linear-gradient(180deg,rgb(255_247_222/0.16),transparent_75%)] blur-2xl" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-canvas to-transparent" />
    </div>
  );
}

function OrgCard({ t, s, featured, muted }: { t: Tournament; s?: TournamentStats; featured?: boolean; muted?: boolean }) {
  return (
    <TournamentCard
      slug={t.slug}
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
          <Link href={`/t/${t.slug}/arbitre`} className="btn-quiet h-8 rounded-md px-2.5 text-[13px]">
            <IconWhistle className="size-4" /> Arbitrer
          </Link>
          <Link href={`/t/${t.slug}/admin`} className="btn-quiet h-8 rounded-md px-2.5 text-[13px]">
            <IconSettings className="size-4" /> Organiser
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
        <div className="card space-y-3 overflow-hidden p-6">
          <div className="hazard -mx-6 -mt-6 mb-5 h-2" aria-hidden />
          <h1 className="display text-4xl">Configuration requise</h1>
          <p className="text-[15px] leading-relaxed text-ink-2">
            Copiez <code className="rounded bg-surface-2 px-1 font-mono text-sm">.env.example</code> vers{" "}
            <code className="rounded bg-surface-2 px-1 font-mono text-sm">.env</code>, renseignez le mot de passe organisateur et le secret de session, puis relancez le serveur.
            La base SQLite se crée toute seule dans <code className="rounded bg-surface-2 px-1 font-mono text-sm">DATA_DIR</code>.
          </p>
        </div>
      </Page>
    </>
  );
}
