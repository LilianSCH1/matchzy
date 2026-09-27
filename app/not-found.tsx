import Link from "next/link";
import { Page, TopBar } from "@/components/TopBar";

export default function NotFound() {
  return (
    <>
      <TopBar brand back="/" />
      <Page narrow>
        <div className="rise mx-auto max-w-sm space-y-6 pt-10 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Page introuvable</h1>
            <p className="text-sm text-ink-2">Ce tournoi ou ce match n&apos;existe pas, ou a été supprimé par l&apos;organisateur.</p>
          </div>
          <Link href="/" className="btn-primary h-12 w-full">
            Voir les tournois
          </Link>
        </div>
      </Page>
    </>
  );
}
