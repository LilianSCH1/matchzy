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
            <span className="board mx-auto grid size-16 place-items-center rounded-[10px] text-led">
              <IconLock className="size-7" />
            </span>
            <p className="eyebrow text-accent-ink">Accès réservé au staff</p>
            <h1 className="display text-[52px]">Vestiaire organisateur</h1>
            <p className="text-[15px] text-ink-2">Créez des tournois, pilotez le planning et corrigez les résultats.</p>
          </div>
          <div className="card overflow-hidden p-5 pt-0">
            <div className="-mx-5 mb-5 h-1.5 bg-accent" aria-hidden />
            <LoginForm next={safeNext(next)} />
          </div>
          <ul className="space-y-2.5">
            {PERKS.map(({ Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-[15px] text-ink-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-md border border-dashed border-accent/60 text-accent-ink">
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
