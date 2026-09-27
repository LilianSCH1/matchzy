import { IconLock } from "@/components/Icons";
import { LoginForm } from "@/components/LoginForm";
import { Page, TopBar } from "@/components/TopBar";
import { safeNext } from "@/lib/rules";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <TopBar brand back="/" />
      <Page narrow>
        <div className="rise mx-auto max-w-sm space-y-6 pt-10">
          <div className="space-y-3 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-surface-2">
              <IconLock className="size-5" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">Espace organisateur</h1>
            <p className="text-sm text-ink-2">Créez des tournois, gérez le planning et corrigez les résultats.</p>
          </div>
          <LoginForm next={safeNext(next)} />
        </div>
      </Page>
    </>
  );
}
