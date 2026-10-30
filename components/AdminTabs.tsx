"use client";

// Navigation de l'espace organisateur : barre latérale (ordinateur) et barre d'onglets en bas (mobile).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCalendar, IconGrid, IconSettings, IconUsers } from "./Icons";

function items(base: string) {
  return [
    { href: base, label: "Tableau de bord", short: "Tableau", Icon: IconGrid },
    { href: `${base}/planning`, label: "Planning", short: "Planning", Icon: IconCalendar },
    { href: `${base}/equipes`, label: "Équipes", short: "Équipes", Icon: IconUsers },
    { href: `${base}/regles`, label: "Règles et accès", short: "Réglages", Icon: IconSettings },
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
            className={`group flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-[15px] font-semibold transition ${
              on ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
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
              className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-md py-1.5 text-[12px] font-semibold transition ${on ? "text-accent-ink" : "text-ink-3"}`}
            >
              <Icon className="size-5" />
              {short}
              {!!n && <span className="absolute top-0.5 left-1/2 ml-2 size-2 rounded-full bg-warn ring-2 ring-canvas" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
