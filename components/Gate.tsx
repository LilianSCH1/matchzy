import Link from "next/link";
import { IconBack, IconWhistle } from "./Icons";
import { JoinGate } from "./Participant";
import { SportBadge } from "./Stadium";
import { ThemeToggle } from "./ThemeToggle";
import { Page } from "./TopBar";

/** Contrôle à l'entrée : le tournoi n'est visible qu'avec le code participant (ou un accès organisateur / arbitre). */
export function Gate({ name, sport, slug }: { name: string; sport: string; slug: string }) {
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-5xl px-3 pt-2 pb-5 sm:px-5">
          <div className="flex h-12 items-center gap-1">
            <Link href="/" className="btn-icon -ml-1" aria-label="Accueil">
              <IconBack />
            </Link>
            <span className="mr-auto" />
            <Link href={`/t/${slug}/arbitre`} className="btn-quiet h-9 gap-1.5 px-2.5 text-sm" title="Espace arbitre">
              <IconWhistle className="size-4" />
              <span className="hidden sm:inline">Arbitre</span>
            </Link>
            <ThemeToggle />
          </div>
          <div className="mt-3 space-y-2 px-1">
            <SportBadge name={sport} />
            <h1 className="display text-[28px] sm:text-[34px]">{name}</h1>
            <p className="text-[15px] text-ink-2">Entrez le code donné par l&apos;organisateur pour suivre ce tournoi.</p>
          </div>
        </div>
      </header>
      <Page narrow>
        <JoinGate slug={slug} />
      </Page>
    </>
  );
}
