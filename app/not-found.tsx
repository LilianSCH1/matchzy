import Link from "next/link";
import { CourtLines } from "@/components/Stadium";
import { Footer, Page, TopBar } from "@/components/TopBar";

export default function NotFound() {
  return (
    <>
      <TopBar brand back="/" />
      <Page narrow>
        <div className="rise relative isolate mx-auto max-w-sm space-y-6 pt-10 text-center">
          <CourtLines sport="football" className="absolute inset-x-0 -top-4 -z-10 mx-auto h-56 text-ink opacity-[0.07]" />
          {/* Le drapeau levé du juge de touche */}
          <div className="board mx-auto inline-flex items-center gap-3 rounded-[10px] px-5 py-3">
            <span className="led text-[56px] leading-none">404</span>
          </div>
          <div className="space-y-2">
            <h1 className="display text-[64px]">Hors-jeu&nbsp;!</h1>
            <p className="text-[15px] text-ink-2">Ce tournoi ou ce match n&apos;existe pas, ou a été supprimé par l&apos;organisateur.</p>
          </div>
          <Link href="/" className="btn-accent h-12 w-full">
            Retour au rond central
          </Link>
        </div>
      </Page>
      <Footer />
    </>
  );
}
