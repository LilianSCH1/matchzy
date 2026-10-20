// Index de la palette de commandes (⌘K) : navigation, équipes et matchs d'un tournoi.
// Fonctions pures : construites côté serveur, filtrées côté client.
import type { TournamentBundle, Tournament } from "./types";
import { byTime, fmtDate, fmtTime, View } from "./view";

export type CommandIcon =
  | "home"
  | "bolt"
  | "list"
  | "bracket"
  | "calendar"
  | "screen"
  | "grid"
  | "users"
  | "settings"
  | "whistle"
  | "plus"
  | "trophy"
  | "court"
  | "eye"
  | "theme"
  | "lock";

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  /** Destination ; absente pour les actions intégrées à la palette (ex. thème). */
  href?: string;
  action?: "theme";
  icon?: CommandIcon;
  keywords?: string;
  live?: boolean;
}

export interface CommandGroup {
  id: string;
  label: string;
  items: CommandItem[];
}

/** Minuscules sans accents, pour une recherche tolérante (« equipe » trouve « Équipe »). */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function score(item: CommandItem, words: string[]): number {
  const label = normalize(item.label);
  const hay = `${label} ${normalize(item.hint ?? "")} ${normalize(item.keywords ?? "")}`;
  if (!words.every((w) => hay.includes(w))) return 0;
  const q = words.join(" ");
  if (label.startsWith(q)) return 4;
  if (label.split(/[\s-]+/).some((part) => part.startsWith(words[0]))) return 3;
  if (label.includes(q)) return 2;
  return 1;
}

/** Filtre et classe les commandes ; sans requête, chaque groupe est tronqué à `limit` entrées. */
export function searchCommands(groups: CommandGroup[], query: string, limit = 6): CommandGroup[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return groups
    .map((g) => {
      if (!words.length) return { ...g, items: g.items.slice(0, limit) };
      const items = g.items
        .map((it, i) => ({ it, s: score(it, words), i }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s || a.i - b.i)
        .slice(0, limit * 2)
        .map((x) => x.it);
      return { ...g, items };
    })
    .filter((g) => g.items.length > 0);
}

/** Commandes d'un tournoi : pages, équipes, matchs (en cours d'abord). */
export function tournamentCommands(b: TournamentBundle, opts: { org: boolean }): CommandGroup[] {
  const v = new View(b);
  const t = b.tournament;
  const base = `/t/${t.slug}`;
  const pages: CommandItem[] = [
    { id: "p-direct", label: "En direct", hint: t.name, href: base, icon: "bolt", keywords: "live scores" },
    ...(t.format !== "knockout" ? [{ id: "p-cls", label: "Classements", hint: t.name, href: `${base}?v=classements`, icon: "list" as const, keywords: "poules" }] : []),
    ...(t.format !== "pools" ? [{ id: "p-ko", label: "Phase finale", hint: t.name, href: `${base}?v=tableau`, icon: "bracket" as const, keywords: "tableau finale" }] : []),
    { id: "p-prog", label: "Programme", hint: t.name, href: `${base}?v=programme`, icon: "calendar", keywords: "horaires planning" },
    { id: "p-screen", label: "Écran géant", hint: "À projeter sur place", href: `${base}/ecran`, icon: "screen", keywords: "tv projection" },
    { id: "p-ref", label: "Saisie des scores", hint: `Par ${t.rules.labels.court}`, href: `${base}/arbitre`, icon: "whistle", keywords: "arbitre arbitrage" },
  ];
  if (opts.org) {
    pages.push(
      { id: "a-dash", label: "Tableau de bord", hint: "Organisation", href: `${base}/admin`, icon: "grid", keywords: "admin pilotage" },
      { id: "a-plan", label: "Planning", hint: "Organisation", href: `${base}/admin/planning`, icon: "calendar", keywords: "horaires décaler échanger" },
      { id: "a-teams", label: "Équipes", hint: "Organisation", href: `${base}/admin/equipes`, icon: "users", keywords: "abandon fair-play" },
      { id: "a-rules", label: "Règles & accès", hint: "Organisation", href: `${base}/admin/regles`, icon: "settings", keywords: "codes arbitres terrains" },
    );
  }

  const pools = new Map(b.pools.map((p) => [p.id, p.name]));
  const teams: CommandItem[] = [...b.teams]
    .sort((a, c) => a.name.localeCompare(c.name))
    .map((x) => ({
      id: `t-${x.id}`,
      label: x.name,
      hint: [x.pool_id ? `Poule ${pools.get(x.pool_id)}` : null, x.withdrawn ? "abandon" : "Voir ses matchs"].filter(Boolean).join(" · "),
      href: `${base}?v=programme&equipe=${x.id}`,
      icon: "users",
      keywords: "équipe",
    }));

  const rank = (s: string) => (s === "live" ? 0 : s === "scheduled" ? 1 : 2);
  const matches: CommandItem[] = v
    .playable()
    .sort((a, c) => rank(a.status) - rank(c.status) || byTime(a, c))
    .map((m) => ({
      id: `m-${m.id}`,
      label: `${v.home(m)} – ${v.away(m)}`,
      hint: [m.label, fmtTime(m.scheduled_at, v.tz), v.court(m), m.status === "finished" ? `${m.home_score}-${m.away_score}` : null].filter(Boolean).join(" · "),
      href: opts.org ? `${base}/match/${m.id}` : `${base}?v=programme#m-${m.id}`,
      icon: m.phase === "knockout" ? "trophy" : "court",
      keywords: `match ${m.status === "live" ? "en cours direct" : ""}`,
      live: m.status === "live",
    }));

  return [
    { id: "pages", label: t.name, items: pages },
    { id: "teams", label: "Équipes", items: teams },
    { id: "matches", label: "Matchs", items: matches },
  ];
}

/** Commandes de l'accueil : tournois et outils de l'organisateur. */
export function homeCommands(list: Tournament[], opts: { org: boolean }): CommandGroup[] {
  const groups: CommandGroup[] = [
    {
      id: "tournaments",
      label: "Tournois",
      items: list.map((t) => ({ id: `tn-${t.id}`, label: t.name, hint: `${t.sport_name} · ${fmtDate(t.date)}`, href: `/t/${t.slug}`, icon: "trophy" as const })),
    },
  ];
  if (opts.org) {
    groups.unshift({
      id: "org",
      label: "Organisation",
      items: [
        { id: "o-new", label: "Nouveau tournoi", hint: "Assistant de création", href: "/nouveau", icon: "plus", keywords: "créer" },
        { id: "o-sports", label: "Sports & règles", hint: "Modèles de règles", href: "/sports", icon: "settings", keywords: "barème" },
        ...list.map((t) => ({ id: `ta-${t.id}`, label: `Organiser ${t.name}`, hint: "Tableau de bord", href: `/t/${t.slug}/admin`, icon: "grid" as const })),
      ],
    });
  }
  return groups;
}
