import Link from "next/link";
import { IconBack } from "./Icons";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="grid size-7 place-items-center rounded-[9px] bg-[#111112] ring-1 ring-line">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
          <path d="M4 6.5h5v11H4M9 12h5" stroke="var(--accent)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="17.5" cy="12" r="2.6" fill="var(--accent)" />
        </svg>
      </span>
      <span className="text-[17px] font-semibold tracking-tight">matchzy</span>
    </span>
  );
}

export function TopBar({
  title,
  subtitle,
  back,
  right,
  brand,
}: {
  title?: string;
  subtitle?: string;
  back?: string;
  right?: React.ReactNode;
  brand?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-3 sm:px-5">
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
        {right && <div className="flex shrink-0 items-center gap-1">{right}</div>}
      </div>
    </header>
  );
}

/** Lien discret de l'en-tête (icône seule sur mobile, libellé à partir de sm). */
export function TopLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="btn-quiet h-9 gap-1.5 px-3 text-sm" aria-label={label} title={label}>
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

export function TabBar({ items, active }: { items: { href: string; label: string; key: string; icon?: React.ReactNode }[]; active: string }) {
  return (
    <nav className="sticky top-14 z-20 border-b border-line bg-canvas/85 backdrop-blur-xl">
      <div className="no-scrollbar mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 py-2 sm:px-5">
        {items.map((i) => {
          const on = i.key === active;
          return (
            <Link
              key={i.key}
              href={i.href}
              aria-current={on ? "page" : undefined}
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition ${
                on ? "bg-ink text-canvas" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {i.icon}
              {i.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export const Tabs = TabBar;

export function Section({ title, children, action, hint }: { title: string; children: React.ReactNode; action?: React.ReactNode; hint?: string }) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {hint && <p className="mt-0.5 text-[13px] text-ink-3">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-3">{children}</p>;
}

export function Page({ children, narrow }: { children: React.ReactNode; narrow?: boolean }) {
  return <main className={`mx-auto space-y-8 px-4 pt-6 pb-16 sm:px-5 ${narrow ? "max-w-xl" : "max-w-5xl"}`}>{children}</main>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "danger" | "ok"; children: React.ReactNode }) {
  const cls = {
    info: "bg-surface-2 text-ink-2",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
    ok: "bg-accent-soft text-ink",
  }[tone];
  return <div className={`rounded-xl px-4 py-3 text-sm ${cls}`}>{children}</div>;
}
