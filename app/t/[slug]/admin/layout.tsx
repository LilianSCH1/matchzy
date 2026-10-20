import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { AdminDock, AdminNav } from "@/components/AdminTabs";
import { Commands, SearchButton } from "@/components/CommandPalette";
import { SubmitButton } from "@/components/feedback";
import { IconBack, IconExternal, IconEye, IconLogout, IconScreen, IconSettings, IconWhistle } from "@/components/Icons";
import { LiveRefresh } from "@/components/LiveRefresh";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/TopBar";
import { tournamentCommands } from "@/lib/commands";
import { tournamentInsights } from "@/lib/insights";
import { bundleOr404, requireOrganizerPage } from "@/lib/server/page";
import { fmtDate } from "@/lib/view";

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireOrganizerPage(`/t/${slug}/admin`);
  const b = await bundleOr404(slug);
  const t = b.tournament;
  const pub = `/t/${t.slug}`;
  const base = `${pub}/admin`;
  const live = b.matches.filter((m) => m.status === "live").length;
  const urgent = tournamentInsights(b).filter((i) => i.tone === "danger" || i.tone === "warn");
  const badges = {
    [base]: urgent.filter((i) => !i.href?.endsWith("/planning")).length,
    [`${base}/planning`]: urgent.filter((i) => i.href?.endsWith("/planning")).length,
  };

  const onSite = [
    { href: `${pub}/arbitre`, label: "Saisie des scores", Icon: IconWhistle },
    { href: pub, label: "Vue publique", Icon: IconEye },
    { href: `${pub}/ecran`, label: "Écran géant", Icon: IconScreen, external: true },
  ];

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <LiveRefresh seconds={10} />
      <Commands groups={tournamentCommands(b, { org: true })} />

      {/* Barre latérale (ordinateur) */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-5 border-r border-line bg-surface-2/60 px-3 py-4 lg:flex">
        <div className="flex items-center justify-between px-1.5">
          <Link href="/" aria-label="Accueil">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>

        <div className="card-quiet space-y-2 p-3">
          <div className="flex items-center gap-2">
            <span className="chip h-5 bg-surface-2 px-2 text-[11px] text-ink-2">{t.sport_name}</span>
            {live > 0 && (
              <span className="chip h-5 bg-live-soft px-2 text-[11px] text-live">
                <span className="live-dot size-1.5 rounded-full bg-live" /> {live} en cours
              </span>
            )}
          </div>
          <div className="text-[15px] leading-snug font-semibold tracking-tight">{t.name}</div>
          <div className="text-xs text-ink-3 first-letter:uppercase">{fmtDate(t.date)}</div>
        </div>

        <SearchButton />

        <div className="space-y-1.5">
          <div className="eyebrow px-2.5">Pilotage</div>
          <AdminNav base={base} badges={badges} />
        </div>

        <div className="space-y-1.5">
          <div className="eyebrow px-2.5">Sur place</div>
          <nav className="space-y-0.5">
            {onSite.map(({ href, label, Icon, external }) => (
              <Link
                key={href}
                href={href}
                target={external ? "_blank" : undefined}
                className="group flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-sm font-medium text-ink-2 transition hover:bg-surface-3/60 hover:text-ink"
              >
                <Icon className="size-[18px] text-ink-3 group-hover:text-ink-2" />
                <span className="flex-1">{label}</span>
                {external && <IconExternal className="size-3.5 text-ink-3 opacity-0 transition group-hover:opacity-100" />}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-auto space-y-0.5 border-t border-line pt-3">
          <Link href="/" className="flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-sm text-ink-2 transition hover:bg-surface-3/60 hover:text-ink">
            <IconBack className="size-[18px] text-ink-3" /> Tous les tournois
          </Link>
          <Link href="/sports" className="flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-sm text-ink-2 transition hover:bg-surface-3/60 hover:text-ink">
            <IconSettings className="size-[18px] text-ink-3" /> Sports &amp; règles
          </Link>
          <form action={logoutAction}>
            <SubmitButton className="flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-sm text-ink-2 transition hover:bg-surface-3/60 hover:text-ink" pendingLabel="Déconnexion…">
              <IconLogout className="size-[18px] text-ink-3" /> Se déconnecter
            </SubmitButton>
          </form>
        </div>
      </aside>

      <div className="min-w-0 pb-24 lg:pb-0">
        {/* En-tête mobile */}
        <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur-xl lg:hidden">
          <div className="flex h-14 items-center gap-2 px-3">
            <Link href="/" className="btn-icon -ml-1" aria-label="Tous les tournois">
              <IconBack />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] leading-tight font-semibold tracking-tight">{t.name}</div>
              <div className="flex items-center gap-1.5 truncate text-xs text-ink-3">
                {live > 0 && <span className="live-dot size-1.5 rounded-full bg-live" />}
                {live > 0 ? `${live} match${live > 1 ? "s" : ""} en cours` : "Organisation"}
              </div>
            </div>
            <Link href={`${pub}/arbitre`} className="btn-icon" aria-label="Saisie des scores" title="Saisie des scores">
              <IconWhistle className="size-[18px]" />
            </Link>
            <Link href={pub} className="btn-icon" aria-label="Vue publique" title="Vue publique">
              <IconEye className="size-[18px]" />
            </Link>
            <ThemeToggle />
          </div>
        </header>
        {children}
      </div>

      <AdminDock base={base} badges={badges} />
    </div>
  );
}
