// Fonctions d'affichage partagées (serveur et client).
import type { Match, SlotSource, TournamentBundle } from "./types";

export function fmtTime(iso: string | null, tz: string): string {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: tz });
}

export function fmtDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

export function ordinal(n: number): string {
  return n === 1 ? "1er" : `${n}e`;
}

export class View {
  teams: Map<string, string>;
  pools: Map<string, string>;
  courts: Map<string, string>;
  matches: Map<string, Match>;
  constructor(public b: TournamentBundle) {
    this.teams = new Map(b.teams.map((t) => [t.id, t.name]));
    this.pools = new Map(b.pools.map((p) => [p.id, p.name]));
    this.courts = new Map(b.courts.map((c) => [c.id, c.name]));
    this.matches = new Map(b.matches.map((m) => [m.id, m]));
  }

  get tz() {
    return this.b.tournament.timezone;
  }

  sourceLabel(src: SlotSource | null): string {
    if (!src) return "Exempt";
    switch (src.type) {
      case "team":
        return this.teams.get(src.teamId) ?? "?";
      case "pool":
        return `${ordinal(src.rank)} poule ${this.pools.get(src.poolId) ?? "?"}`;
      case "best":
        return `${src.index === 1 ? "Meilleur" : `${src.index}e meilleur`} ${ordinal(src.rank)}`;
      case "winner":
        return `Vainq. ${this.matches.get(src.matchId)?.label ?? "?"}`;
      case "loser":
        return `Perd. ${this.matches.get(src.matchId)?.label ?? "?"}`;
    }
  }

  home(m: Match): string {
    return m.home_team_id ? (this.teams.get(m.home_team_id) ?? "?") : this.sourceLabel(m.home_source);
  }

  away(m: Match): string {
    return m.away_team_id ? (this.teams.get(m.away_team_id) ?? "?") : this.sourceLabel(m.away_source);
  }

  court(m: Match): string {
    return m.court_id ? (this.courts.get(m.court_id) ?? "") : "";
  }

  playable(): Match[] {
    return this.b.matches.filter((m) => !m.is_bye);
  }

  live(): Match[] {
    return this.playable().filter((m) => m.status === "live");
  }

  /** Prochain match non commencé de chaque terrain. */
  nextByCourt(count = 1): { courtId: string; matches: Match[] }[] {
    return this.b.courts.map((c) => ({
      courtId: c.id,
      matches: this.playable()
        .filter((m) => m.court_id === c.id && m.status === "scheduled")
        .sort(byTime)
        .slice(0, count),
    }));
  }

  /** Retard (minutes) d'un match programmé dont l'heure est dépassée. */
  delay(m: Match, now = Date.now()): number {
    if (m.status !== "scheduled" || !m.scheduled_at) return 0;
    return Math.max(0, Math.floor((now - new Date(m.scheduled_at).getTime()) / 60000));
  }
}

export function byTime(a: Match, b: Match): number {
  return (a.scheduled_at ?? "9").localeCompare(b.scheduled_at ?? "9") || (a.court_id ?? "").localeCompare(b.court_id ?? "");
}

export const STATUS_LABEL: Record<Match["status"], string> = {
  scheduled: "Programmé",
  live: "En cours",
  finished: "Terminé",
};

export const FORMAT_LABEL = {
  pools: "Poules (championnat)",
  pools_knockout: "Poules + phase finale",
  knockout: "Élimination directe",
} as const;
