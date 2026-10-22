import Link from "next/link";
import { IconBack, IconWhistle } from "./Icons";
import { JoinGate } from "./Participant";
import { CourtLines, SportBadge, sportKey } from "./Stadium";
import { ThemeToggle } from "./ThemeToggle";
import { Logo, Page } from "./TopBar";

/** Contrôle à l'entrée : le tournoi n'est visible qu'avec le code participant (ou un accès organisateur / arbitre). */
export function Gate({ name, sport, slug }: { name: string; sport: string; slug: string }) {
  const key = sportKey(sport);
  return (
    <>
      <header data-sport={key} className="theme-dark turf relative isolate overflow-hidden border-b border-line">
        <CourtLines sport={key} aria-hidden className="absolute top-1/2 right-[-10%] -z-10 h-[150%] w-auto -translate-y-1/2 text-white/[0.12]" />
        <div className="mx-auto max-w-5xl px-3 pt-2 pb-8 sm:px-5">
          <div className="flex h-12 items-center gap-1">
            <Link href="/" className="btn-icon -ml-1" aria-label="Accueil">
              <IconBack />
            </Link>
            <Link href="/" className="mr-auto opacity-80" aria-label="Matchzy, accueil">
              <Logo />
            </Link>
            <Link href={`/t/${slug}/arbitre`} className="btn-quiet h-9 gap-1.5 px-2.5 text-sm" title="Arbitrer">
              <IconWhistle className="size-4" />
              <span className="hidden sm:inline">Arbitre</span>
            </Link>
            <ThemeToggle />
          </div>
          <div className="mt-5 space-y-3 px-1">
            <SportBadge name={sport} className="bg-black/40!" />
            <h1 className="display text-[clamp(2.6rem,8vw,5rem)]">{name}</h1>
            <p className="font-cond text-[15px] font-semibold tracking-[0.08em] text-ink-2 uppercase">Accès réservé aux participants · code fourni par l&apos;organisateur</p>
          </div>
        </div>
      </header>
      <Page narrow>
        <JoinGate slug={slug} />
      </Page>
    </>
  );
}
