"use client";

// Navigation de l'espace organisateur : barre latérale (ordinateur) et barre d'onglets en bas (mobile).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { openCommandPalette } from "./CommandPalette";
import { IconCalendar, IconGrid, IconSearch, IconSettings, IconUsers } from "./Icons";

function items(base: string) {
  return [
    { href: base, label: "Tableau de bord", short: "Pilotage", Icon: IconGrid },
    { href: `${base}/planning`, label: "Planning", short: "Planning", Icon: IconCalendar },
    { href: `${base}/equipes`, label: "Équipes", short: "Équipes", Icon: IconUsers },
    { href: `${base}/regles`, label: "Règles & accès", short: "Réglages", Icon: IconSettings },
  ];
}

export function AdminNav({ base, badges = {} }: { base: string; badges?: Record<string, number> }) {
  const path = usePathname();
  return (
    <nav className="space-y-0.5" aria-label="Organisation">
      {items(base).map(({ href, label, Icon }) => {
        const on = path === href;
        const n = badges[href];
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`group flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-sm font-medium transition ${
              on ? "bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06),0_0_0_1px_var(--line)]" : "text-ink-2 hover:bg-surface-3/60 hover:text-ink"
            }`}
          >
            <Icon className={`size-[18px] ${on ? "text-accent-ink" : "text-ink-3 group-hover:text-ink-2"}`} />
            <span className="flex-1">{label}</span>
            {!!n && <span className="chip h-5 bg-warn-soft px-1.5 text-[11px] text-warn tabular-nums">{n}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminDock({ base, badges = {} }: { base: string; badges?: Record<string, number> }) {
  const path = usePathname();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/90 backdrop-blur-xl lg:hidden" aria-label="Organisation">
      <div className="mx-auto flex max-w-xl gap-1 px-2 pt-1">
        {items(base).map(({ href, short, Icon }) => {
          const on = path === href;
          const n = badges[href];
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition ${on ? "text-accent-ink" : "text-ink-3"}`}
            >
              <Icon className="size-5" />
              {short}
              {!!n && <span className="absolute top-0.5 left-1/2 ml-2 size-2 rounded-full bg-warn ring-2 ring-canvas" />}
            </Link>
          );
        })}
        <button type="button" onClick={openCommandPalette} className="flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium text-ink-3">
          <IconSearch className="size-5" />
          Chercher
        </button>
      </div>
    </nav>
  );
}
