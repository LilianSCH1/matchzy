import { LoginForm } from "@/components/LoginForm";
import { Footer, Page, TopBar } from "@/components/TopBar";
import { safeNext } from "@/lib/rules";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <TopBar brand back="/" />
      <Page narrow>
        <div className="mx-auto max-w-sm space-y-6 pt-6">
          <div className="space-y-2">
            <h1 className="display text-[30px]">Espace organisateur</h1>
            <p className="text-[15px] text-ink-2">Connectez-vous pour créer vos tournois, gérer le planning et saisir les scores.</p>
          </div>
          <div className="card p-5">
            <LoginForm next={safeNext(next)} />
          </div>
          <p className="text-[14px] text-ink-3">Vous êtes joueur ou spectateur ? Pas besoin de compte : revenez à l&apos;accueil et entrez le code du tournoi.</p>
        </div>
      </Page>
      <Footer />
    </>
  );
}
