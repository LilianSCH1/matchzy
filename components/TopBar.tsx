import Link from "next/link";
import { SearchButton } from "./CommandPalette";
import { IconBack } from "./Icons";
import { ThemeToggle } from "./ThemeToggle";

export function Logo({ className = "", mark = false }: { className?: string; mark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="grid size-7 place-items-center rounded-[9px] bg-accent shadow-[0_1px_0_rgb(255_255_255/0.25)_inset,0_2px_6px_-1px_color-mix(in_oklab,var(--accent)_60%,transparent)]">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
          <path d="M4 6.5h5v11H4M9 12h5" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="17.5" cy="12" r="2.6" fill="#fff" />
        </svg>
      </span>
      {!mark && <span className="text-[17px] font-semibold tracking-tight">matchzy</span>}
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
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur-xl">
      <div className={`mx-auto flex h-14 items-center gap-2 px-3 sm:px-5 ${wide ? "max-w-7xl" : "max-w-5xl"}`}>
        {back && (
          <Link href={back} className="btn-icon -ml-1" aria-label="Retour">
            <IconBack />
          </Link>
        )}
        {brand ? (
          <Link href="/" className="mr-auto">
            <Logo />
          </Link>
        ) : (
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] leading-tight font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="truncate text-xs text-ink-3">{subtitle}</p>}
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
          ? "pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/90 backdrop-blur-xl sm:sticky sm:top-0 sm:bottom-auto sm:border-t-0 sm:border-b sm:pb-0"
          : "sticky top-14 z-20 border-b border-line bg-canvas/80 backdrop-blur-xl"
      }
      aria-label="Sections"
    >
      <div className={`mx-auto flex max-w-5xl gap-1 px-2 sm:px-5 sm:py-2 ${dock ? "py-1" : "no-scrollbar overflow-x-auto py-2"}`}>
        {items.map((i) => {
          const on = i.key === active;
          return (
            <Link
              key={i.key}
              href={i.href}
              scroll={false}
              aria-current={on ? "page" : undefined}
              className={
                dock
                  ? `flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition sm:h-9 sm:flex-none sm:flex-row sm:gap-1.5 sm:px-3.5 sm:text-sm ${
                      on ? "text-accent-ink sm:bg-ink sm:text-canvas" : "text-ink-3 hover:text-ink sm:text-ink-2 sm:hover:bg-surface-2"
                    }`
                  : `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-sm font-medium transition ${
                      on ? "bg-ink text-canvas" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                    }`
              }
            >
              {i.icon}
              <span className="truncate">{i.label}</span>
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
          <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
            {icon && <span className="text-ink-3">{icon}</span>}
            {title}
            {count !== undefined && <span className="chip h-5 bg-surface-2 px-2 text-[11px] text-ink-2 tabular-nums">{count}</span>}
          </h2>
          {hint && <p className="mt-0.5 text-[13px] text-ink-3">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line-strong px-4 py-7 text-center text-sm text-ink-3">
      {icon && <span className="grid size-10 place-items-center rounded-xl bg-surface-2 text-ink-3">{icon}</span>}
      <div>{children}</div>
    </div>
  );
}

export function Page({ children, narrow, wide, className = "" }: { children: React.ReactNode; narrow?: boolean; wide?: boolean; className?: string }) {
  return <main className={`mx-auto space-y-8 px-4 pt-6 pb-16 sm:px-5 ${narrow ? "max-w-xl" : wide ? "max-w-7xl" : "max-w-5xl"} ${className}`}>{children}</main>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "danger" | "ok"; children: React.ReactNode }) {
  const cls = {
    info: "bg-surface-2 text-ink-2",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
    ok: "bg-ok-soft text-ok",
  }[tone];
  return <div className={`rounded-xl px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

/** En-tête de page (espace organisateur) : titre, description et actions. */
export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 space-y-1">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-[28px]">{title}</h1>
        {description && <p className="max-w-2xl text-sm leading-relaxed text-ink-2">{description}</p>}
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
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(100, Math.max(0, value)) / 100)}
        className="transition-[stroke-dashoffset] duration-700"
      />
    </svg>
  );
}
