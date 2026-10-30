"use client";

// Palette de commandes (⌘K / Ctrl+K / « / ») : recherche instantanée d'une page, d'une équipe ou d'un match.
// Montée une fois dans le layout racine ; chaque page y déclare ses commandes avec <Commands groups={…} />.
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { searchCommands, type CommandGroup, type CommandIcon, type CommandItem } from "@/lib/commands";
import {
  IconBolt,
  IconBracket,
  IconCalendar,
  IconCornerDownLeft,
  IconCourt,
  IconEye,
  IconGrid,
  IconHome,
  IconList,
  IconLock,
  IconMonitor,
  IconPlus,
  IconScreen,
  IconSearch,
  IconSettings,
  IconTrophy,
  IconUsers,
  IconWhistle,
} from "./Icons";
import { cycleTheme } from "./ThemeToggle";

// ------------------------------------------------------------------ Registre

const registry = new Map<string, CommandGroup[]>();
let snapshot: CommandGroup[] = [];
const listeners = new Set<() => void>();
const OPEN_EVENT = "matchzy:command";

function publish() {
  snapshot = [...registry.values()].flat();
  listeners.forEach((l) => l());
}

/** Déclare les commandes de la page courante (retirées au démontage). */
export function Commands({ groups }: { groups: CommandGroup[] }) {
  const id = useId();
  const json = JSON.stringify(groups);
  useEffect(() => {
    registry.set(id, JSON.parse(json));
    publish();
    return () => {
      registry.delete(id);
      publish();
    };
  }, [id, json]);
  return null;
}

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/** Champ de recherche factice qui ouvre la palette. */
export function SearchButton({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  if (compact)
    return (
      <button type="button" className={`btn-icon ${className}`} onClick={openCommandPalette} aria-label="Rechercher (Ctrl K)" title="Rechercher (Ctrl K)">
        <IconSearch className="size-[18px]" />
      </button>
    );
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className={`flex h-9 w-full items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm text-ink-3 shadow-card transition hover:border-line-strong hover:text-ink-2 ${className}`}
    >
      <IconSearch className="size-4" />
      <span className="flex-1 text-left">Rechercher…</span>
      <span className="kbd">Ctrl K</span>
    </button>
  );
}

// ------------------------------------------------------------------ Palette

const ICONS: Record<CommandIcon, (p: { className?: string }) => React.ReactNode> = {
  home: IconHome,
  bolt: IconBolt,
  list: IconList,
  bracket: IconBracket,
  calendar: IconCalendar,
  screen: IconScreen,
  grid: IconGrid,
  users: IconUsers,
  settings: IconSettings,
  whistle: IconWhistle,
  plus: IconPlus,
  trophy: IconTrophy,
  court: IconCourt,
  eye: IconEye,
  theme: IconMonitor,
  lock: IconLock,
};

const BUILTIN: CommandGroup = {
  id: "general",
  label: "Général",
  items: [
    { id: "g-home", label: "Accueil", hint: "Tous les tournois", href: "/", icon: "home" },
    { id: "g-theme", label: "Changer de thème", hint: "Clair ou sombre", action: "theme", icon: "theme", keywords: "sombre clair dark mode nuit" },
    { id: "g-login", label: "Espace organisateur", hint: "Connexion", href: "/login", icon: "lock", keywords: "admin connexion" },
  ],
};

const EMPTY: CommandGroup[] = [];

export function CommandPalette() {
  const groups = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => snapshot,
    () => EMPTY,
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  if (!open) return null;
  return <PaletteDialog groups={[...groups, BUILTIN]} onClose={() => setOpen(false)} />;
}

function PaletteDialog({ groups, onClose }: { groups: CommandGroup[]; onClose: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = useMemo(() => searchCommands(groups, query), [groups, query]);
  const flat = useMemo(() => results.flatMap((g) => g.items), [results]);
  const listId = useId();

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (it: CommandItem | undefined) => {
    if (!it) return;
    onClose();
    if (it.action === "theme") cycleTheme();
    else if (it.href) router.push(it.href);
  };

  let index = -1;
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className="dialog-in glass mx-auto mt-[10vh] w-[calc(100%-1.5rem)] max-w-xl overflow-hidden rounded-[10px] border border-line p-0 text-ink shadow-pop backdrop:bg-black/40 backdrop:backdrop-blur-sm"
      aria-label="Palette de commandes"
    >
      <div className="h-1 bg-accent" aria-hidden />
      <div className="flex items-center gap-3 border-b border-line px-4">
        <IconSearch className="size-5 shrink-0 text-ink-3" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(flat.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              run(flat[active]);
            }
          }}
          placeholder="Une équipe, un match, une page…"
          className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-3"
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={flat[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="button" onClick={onClose} className="kbd h-6 px-1.5" aria-label="Fermer">
          Échap
        </button>
      </div>
      <div ref={listRef} id={listId} role="listbox" className="max-h-[min(60vh,28rem)] overflow-y-auto p-2">
        {results.length === 0 && <p className="px-3 py-10 text-center text-sm text-ink-3">Aucun résultat pour « {query} ».</p>}
        {results.map((g) => (
          <div key={g.id} className="pb-1" role="group" aria-label={g.label}>
            <div className="eyebrow truncate px-3 pt-2 pb-1.5">{g.label}</div>
            {g.items.map((it) => {
              index++;
              const i = index;
              const on = i === active;
              const Icon = ICONS[it.icon ?? "eye"];
              return (
                <button
                  key={it.id}
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={on}
                  type="button"
                  onMouseMove={() => setActive(i)}
                  onClick={() => run(it)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${on ? "bg-accent-soft" : ""}`}
                >
                  <span className={`grid size-8 shrink-0 place-items-center rounded-md ${on ? "bg-accent text-on-accent" : "bg-surface-2 text-ink-2"}`}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span className="truncate">{it.label}</span>
                      {it.live && (
                        <span className="chip h-5 shrink-0 bg-live-soft px-2 text-[11px] text-live">
                          <span className="live-dot size-1.5 rounded-full bg-live" /> Direct
                        </span>
                      )}
                    </span>
                    {it.hint && <span className="block truncate text-xs text-ink-3">{it.hint}</span>}
                  </span>
                  {on && <IconCornerDownLeft className="size-4 shrink-0 text-accent-ink" />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 border-t border-line bg-surface-2/60 px-4 py-2.5 text-xs text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="kbd">↑</span>
          <span className="kbd">↓</span> naviguer
        </span>
        <span className="flex items-center gap-1.5">
          <span className="kbd">↵</span> ouvrir
        </span>
        <span className="ml-auto hidden sm:inline">Astuce : « / » ouvre la recherche</span>
      </div>
    </dialog>
  );
}
