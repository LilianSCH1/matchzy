import { IconBolt, IconCalendar, IconLock, IconSparkle } from "@/components/Icons";
import { LoginForm } from "@/components/LoginForm";
import { Page, TopBar } from "@/components/TopBar";
import { safeNext } from "@/lib/rules";

const PERKS = [
  { Icon: IconCalendar, text: "Poules, planning et tableau générés en 4 étapes" },
  { Icon: IconBolt, text: "Scores saisis au bord du terrain, classements recalculés en direct" },
  { Icon: IconSparkle, text: "Un assistant qui repère retards et conflits, et propose la correction" },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <TopBar brand back="/" />
      <Page narrow>
        <div className="rise mx-auto max-w-sm space-y-8 pt-8">
          <div className="space-y-3 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-ink text-canvas shadow-float">
              <IconLock className="size-6" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">Espace organisateur</h1>
            <p className="text-sm text-ink-2">Créez des tournois, pilotez le planning et corrigez les résultats.</p>
          </div>
          <div className="card p-5">
            <LoginForm next={safeNext(next)} />
          </div>
          <ul className="space-y-2.5">
            {PERKS.map(({ Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-ink-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-ink">
                  <Icon className="size-4" />
                </span>
                <span className="pt-1">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </Page>
    </>
  );
}
