import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { AdminDock, AdminNav } from "@/components/AdminTabs";
import { Commands, SearchButton } from "@/components/CommandPalette";
import { SubmitButton } from "@/components/feedback";
import { IconBack, IconExternal, IconEye, IconLogout, IconScreen, IconSettings, IconWhistle } from "@/components/Icons";
import { LiveRefresh } from "@/components/LiveRefresh";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CourtLines, SportBadge, sportKey } from "@/components/Stadium";
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
      <aside data-sport={sportKey(t.sport_name)} className="theme-dark sticky top-0 isolate hidden h-dvh flex-col gap-5 overflow-hidden border-r border-line px-3 py-4 lg:flex">
        <CourtLines sport={sportKey(t.sport_name)} className="absolute -bottom-10 left-1/2 -z-10 h-56 -translate-x-1/2 rotate-90 text-white/[0.05]" />
        <div className="flex items-center justify-between px-1.5">
          <Link href="/" aria-label="Accueil">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>

        <div className="turf space-y-2 rounded-[10px] p-3 ring-1 ring-white/10">
          <div className="flex items-center gap-2">
            <SportBadge name={t.sport_name} className="h-5 bg-black/40! px-1.5 text-[11px]" />
            {live > 0 && (
              <span className="chip h-5 bg-live-soft px-2 text-[11px] text-live">
                <span className="live-dot size-1.5 rounded-full bg-live" /> {live} en cours
              </span>
            )}
          </div>
          <div className="display text-[24px] leading-[0.92]">{t.name}</div>
          <div className="font-cond text-[12px] font-semibold tracking-[0.08em] text-ink-2 uppercase">{fmtDate(t.date)}</div>
        </div>

        <SearchButton />

        <div className="space-y-1.5">
          <div className="eyebrow px-2.5">Banc de touche</div>
          <AdminNav base={base} badges={badges} />
        </div>

        <div className="space-y-1.5">
          <div className="eyebrow px-2.5">Bord du terrain</div>
          <nav className="space-y-0.5">
            {onSite.map(({ href, label, Icon, external }) => (
              <Link
                key={href}
                href={href}
                target={external ? "_blank" : undefined}
                className="group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-ink-2 transition hover:bg-surface-3/60 hover:text-ink"
              >
                <Icon className="size-[18px] text-ink-3 group-hover:text-ink-2" />
                <span className="flex-1">{label}</span>
                {external && <IconExternal className="size-3.5 text-ink-3 opacity-0 transition group-hover:opacity-100" />}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-auto space-y-0.5 border-t border-line pt-3">
          <Link href="/" className="flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm text-ink-2 transition hover:bg-surface-3/60 hover:text-ink">
            <IconBack className="size-[18px] text-ink-3" /> Tous les tournois
          </Link>
          <Link href="/sports" className="flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm text-ink-2 transition hover:bg-surface-3/60 hover:text-ink">
            <IconSettings className="size-[18px] text-ink-3" /> Sports &amp; règles
          </Link>
          <form action={logoutAction}>
            <SubmitButton className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm text-ink-2 transition hover:bg-surface-3/60 hover:text-ink" pendingLabel="Déconnexion…">
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
              <div className="display truncate text-[20px] leading-none">{t.name}</div>
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
