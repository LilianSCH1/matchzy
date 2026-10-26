import Link from "next/link";
import { SearchButton } from "./CommandPalette";
import { IconBack } from "./Icons";
import { CourtLines } from "./Stadium";
import { ThemeToggle } from "./ThemeToggle";

/** Marque : un mini tableau d'affichage, lignes de terrain à la craie et ballon ambre au rond central. */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="6" fill="#060707" />
      <rect x="1.5" y="1.5" width="29" height="29" rx="5.5" fill="none" stroke="rgb(255 255 255 / 0.14)" />
      <g fill="none" stroke="#f3efe4" strokeWidth="1.5">
        <rect x="6" y="8" width="20" height="16" rx="1" />
        <path d="M16 8v16M6 12.5h3.5v7H6M26 12.5h-3.5v7H26" />
      </g>
      <circle cx="16" cy="16" r="3.2" fill="#ffb000" />
      <circle cx="16" cy="16" r="5.5" fill="none" stroke="#ffb000" strokeOpacity="0.35" />
    </svg>
  );
}

export function Logo({ className = "", mark = false }: { className?: string; mark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark />
      {!mark && (
        <span className="display text-[24px] leading-none tracking-[0.02em]">
          Match<span className="text-accent">zy</span>
        </span>
      )}
    </span>
  );
}

export function TopBar({
  title,
  subtitle,
  back,
  right,
  brand,
  tools = true,
  wide = false,
}: {
  title?: string;
  subtitle?: string;
  back?: string;
  right?: React.ReactNode;
  brand?: boolean;
  /** Recherche (⌘K) et thème à droite. */
  tools?: boolean;
  wide?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-xl">
      <div className={`mx-auto flex h-14 items-center gap-2 px-3 sm:px-5 ${wide ? "max-w-7xl" : "max-w-5xl"}`}>
        {back && (
          <Link href={back} className="btn-icon -ml-1" aria-label="Retour">
            <IconBack />
          </Link>
        )}
        {brand ? (
          <Link href="/" className="mr-auto" aria-label="Matchzy, accueil">
            <Logo />
          </Link>
        ) : (
          <div className="min-w-0 flex-1">
            <h1 className="display truncate text-[22px] leading-none">{title}</h1>
            {subtitle && <p className="mt-0.5 truncate font-cond text-[12px] font-semibold tracking-[0.08em] text-ink-3 uppercase">{subtitle}</p>}
          </div>
        )}
        <div className="flex shrink-0 items-center gap-1">
          {right}
          {tools && (
            <>
              <SearchButton compact />
              <ThemeToggle />
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/** Lien discret de l'en-tête (icône seule sur mobile, libellé à partir de sm). */
export function TopLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="btn-quiet h-9 gap-1.5 px-2.5 text-sm" aria-label={label} title={label}>
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

/**
 * Onglets de page. Sur mobile, ils deviennent une barre de navigation fixée en bas de l'écran (à portée de pouce) ;
 * prévoir `pb-24 sm:pb-16` sur le contenu.
 */
export function TabBar({ items, active, dock = false }: { items: { href: string; label: string; key: string; icon?: React.ReactNode }[]; active: string; dock?: boolean }) {
  return (
    <nav
      className={
        dock
          ? "pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/92 backdrop-blur-xl sm:sticky sm:top-0 sm:bottom-auto sm:border-t-0 sm:border-b sm:pb-0"
          : "sticky top-14 z-20 border-b border-line bg-canvas/85 backdrop-blur-xl"
      }
      aria-label="Sections"
    >
      <div className={`mx-auto flex max-w-5xl gap-1 px-2 sm:px-5 ${dock ? "py-1 sm:py-0" : "no-scrollbar overflow-x-auto"}`}>
        {items.map((i) => {
          const on = i.key === active;
          return (
            <Link
              key={i.key}
              href={i.href}
              scroll={false}
              aria-current={on ? "page" : undefined}
              className={`relative font-cond font-bold tracking-[0.08em] uppercase transition ${
                dock
                  ? "flex flex-1 flex-col items-center gap-0.5 rounded-md py-1.5 text-[11px] sm:h-12 sm:flex-none sm:flex-row sm:gap-2 sm:px-3.5 sm:text-[14px]"
                  : "inline-flex h-12 shrink-0 items-center gap-2 px-3.5 text-[14px]"
              } ${on ? "text-accent-ink sm:text-ink" : "text-ink-3 hover:text-ink"}`}
            >
              {i.icon}
              <span className="truncate">{i.label}</span>
              {/* Liseré orange de l'onglet actif, comme le bandeau d'une retransmission. */}
              {on && <span className={`absolute inset-x-2 h-[3px] rounded-full bg-accent ${dock ? "top-0 sm:top-auto sm:bottom-0" : "bottom-0"}`} />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export const Tabs = TabBar;

export function Section({
  title,
  children,
  action,
  hint,
  icon,
  count,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  count?: number;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="display flex items-center gap-2.5 text-[26px]">
            {icon && <span className="text-accent">{icon}</span>}
            {title}
            {count !== undefined && (
              <span className="board inline-flex h-6 min-w-7 items-center justify-center rounded-[4px] px-1.5 font-led text-[15px] leading-none font-extrabold text-led tabular-nums">
                {count}
              </span>
            )}
          </h2>
          {hint && <p className="mt-1 text-[14px] text-ink-3">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** État vide : un terrain désert, tracé à la craie. */
export function Empty({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="relative isolate flex flex-col items-center gap-2 overflow-hidden rounded-[10px] border border-dashed border-line-strong px-4 py-9 text-center text-[15px] text-ink-3">
      <CourtLines sport="custom" className="absolute inset-0 -z-10 h-full w-full p-3 text-ink opacity-[0.06]" />
      {icon && <span className="grid size-11 place-items-center rounded-full border-2 border-dashed border-line-strong text-ink-3">{icon}</span>}
      <div>{children}</div>
    </div>
  );
}

export function Page({ children, narrow, wide, className = "", id }: { children: React.ReactNode; narrow?: boolean; wide?: boolean; className?: string; id?: string }) {
  return <main id={id} className={`mx-auto space-y-9 px-4 pt-6 pb-16 sm:px-5 ${narrow ? "max-w-xl" : wide ? "max-w-7xl" : "max-w-5xl"} ${className}`}>{children}</main>;
}

/** Pied de page signé : preuve d'authenticité et signature du créateur. */
export function Footer({ wide = false }: { wide?: boolean }) {
  return (
    <footer className="mt-auto border-t border-line bg-surface/40">
      <div className={`mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-5 font-cond text-[12px] font-bold tracking-[0.14em] text-ink-3 uppercase sm:px-5 ${wide ? "max-w-7xl" : "max-w-5xl"}`}>
        <div className="flex items-center gap-2">
          <LogoMark className="size-4" />
          <span>MATCHZY &copy; 2026</span>
        </div>
        <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-xl sm:rounded-full border border-line bg-surface/80 px-3.5 py-1.5 shadow-sm">
          <span className="text-[12px] font-semibold tracking-wider text-ink-2 uppercase">Conçu & développé par</span>
          <span className="hand inline-block -rotate-2 text-[22px] leading-none text-accent [text-shadow:0_0_12px_var(--glow)]">
            Lilian SCHMITT
          </span>
        </div>
        <span>Fin du match</span>
      </div>
    </footer>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "danger" | "ok"; children: React.ReactNode }) {
  const cls = {
    info: "border-line bg-surface-2 text-ink-2",
    warn: "border-warn/40 bg-warn-soft text-warn",
    danger: "border-danger/30 bg-danger-soft text-danger",
    ok: "border-ok/30 bg-ok-soft text-ok",
  }[tone];
  return <div className={`rounded-md border border-l-4 px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

/** En-tête de page (espace organisateur) : titre, description et actions. */
export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 space-y-2">
        {eyebrow && (
          <div className="eyebrow flex items-center gap-2 text-accent-ink">
            <span className="h-[3px] w-5 rounded-full bg-accent" />
            {eyebrow}
          </div>
        )}
        <h1 className="display text-[40px] sm:text-[52px]">{title}</h1>
        {description && <p className="max-w-2xl text-[15px] leading-relaxed text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Anneau de progression (0–100). */
export function Ring({ value, size = 44, stroke = 5, className = "text-accent" }: { value: number; size?: number; stroke?: number; className?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={`-rotate-90 ${className}`} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(100, Math.max(0, value)) / 100)}
        className="transition-[stroke-dashoffset] duration-700"
      />
    </svg>
  );
}

/** Barre de progression en LED : une rangée de points qui s'allument. */
export function LedBar({ value, total, cells = 24, tone = "led", className = "" }: { value: number; total: number; cells?: number; tone?: "led" | "ok"; className?: string }) {
  const lit = total ? Math.round((cells * value) / total) : 0;
  const on = tone === "ok" ? "bg-ok shadow-[0_0_6px_var(--ok)]" : "bg-led shadow-[0_0_6px_rgb(255_176_0/0.7)]";
  return (
    <div className={`flex gap-[3px] ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}>
      {Array.from({ length: cells }, (_, i) => (
        <span key={i} className={`h-2 flex-1 rounded-[2px] ${i < lit ? on : "bg-current opacity-15"}`} />
      ))}
    </div>
  );
}
