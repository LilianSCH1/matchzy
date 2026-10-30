"use client";

import Link from "next/link";
import { useEffect } from "react";
import { IconAlert } from "@/components/Icons";
import { Footer, Page, TopBar } from "@/components/TopBar";

/** Erreur de chargement (base injoignable, réseau coupé…) : message lisible et bouton pour réessayer. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <>
      <TopBar brand back="/" />
      <Page narrow>
        <div className="rise mx-auto max-w-sm space-y-6 pt-10 text-center">
          <div className="board mx-auto inline-flex items-center gap-3 rounded-[10px] px-4 py-3">
            <IconAlert className="size-6 text-warn" />
            <span className="led text-[34px] leading-none">T.MORT</span>
          </div>
          <div className="space-y-2">
            <h1 className="display text-[56px]">Temps mort</h1>
            <p className="text-[15px] text-ink-2">
              Les données du tournoi n&apos;ont pas pu être chargées. Vérifiez le réseau puis réessayez : les scores déjà enregistrés sont conservés.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button className="btn-accent h-12 w-full" onClick={reset}>
              Réessayer
            </button>
            <Link href="/" className="btn-quiet h-12 w-full">
              Retour à l&apos;accueil
            </Link>
          </div>
          {error.digest && <p className="font-mono text-xs text-ink-3">Réf. {error.digest}</p>}
        </div>
      </Page>
      <Footer />
    </>
  );
}
