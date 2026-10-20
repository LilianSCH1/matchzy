// Assistant de l'organisateur : état de chaque terrain, prévision de fin et alertes actionnables.
// Fonctions pures (testées) : tout est déduit du tournoi et de l'heure courante.
import { resolveTournament, type ResolveResult } from "./resolve";
import type { Match, TournamentBundle } from "./types";
import { byTime, fmtTime, View } from "./view";

const MIN = 60000;

export type CourtState = "playing" | "late" | "waiting" | "idle" | "done";

export interface CourtStatus {
  courtId: string;
  name: string;
  state: CourtState;
  live: Match | null;
  next: Match | null;
  /** Matchs non joués suivants (après `next`). */
  later: Match[];
  /** Retard projeté (min) du prochain match : tient compte du match en cours. */
  delay: number;
  /** Minutes écoulées depuis le début du match en cours. */
  elapsed: number | null;
  played: number;
  total: number;
}

/** Retard projeté de chaque terrain : un match en cours qui déborde retarde le suivant avant même son heure. */
export function courtStatuses(b: TournamentBundle, now = Date.now()): CourtStatus[] {
  const v = new View(b);
  const t = b.tournament;
  const matchday = v.isMatchday(now);
  return b.courts.map((c) => {
    const list = v.playable().filter((m) => m.court_id === c.id).sort(byTime);
    const live = list.find((m) => m.status === "live") ?? null;
    const pending = list.filter((m) => m.status === "scheduled");
    const next = pending[0] ?? null;
    const elapsed = matchday && live?.started_at ? Math.max(0, Math.floor((now - new Date(live.started_at).getTime()) / MIN)) : null;

    let delay = 0;
    if (matchday && next?.scheduled_at) {
      const planned = new Date(next.scheduled_at).getTime();
      let earliest = now;
      if (live) {
        const liveEnd = live.started_at ? new Date(live.started_at).getTime() + t.match_duration * MIN : now;
        earliest = Math.max(now, liveEnd) + t.break_duration * MIN;
      }
      delay = Math.max(0, Math.floor((earliest - planned) / MIN));
    }

    let state: CourtState;
    if (!live && !next) state = "done";
    else if (live) state = delay >= 5 ? "late" : "playing";
    else if (delay >= 1) state = "late";
    else state = matchday && next?.scheduled_at && new Date(next.scheduled_at).getTime() - now > (t.break_duration + 10) * MIN ? "idle" : "waiting";

    return {
      courtId: c.id,
      name: c.name,
      state,
      live,
      next,
      later: pending.slice(1),
      delay,
      elapsed,
      played: list.filter((m) => m.status === "finished").length,
      total: list.length,
    };
  });
}

export interface Forecast {
  /** Fin prévue au planning (dernier match). */
  plannedEnd: Date | null;
  /** Fin projetée en tenant compte des retards de chaque terrain. */
  projectedEnd: Date | null;
  maxDelay: number;
  done: number;
  total: number;
  live: number;
}

export function forecast(b: TournamentBundle, now = Date.now(), courts = courtStatuses(b, now)): Forecast {
  const v = new View(b);
  const all = v.playable();
  const dur = b.tournament.match_duration * MIN;
  let planned = 0;
  let projected = 0;
  for (const c of courts) {
    const list = all.filter((m) => m.court_id === c.courtId && m.scheduled_at);
    if (!list.length) continue;
    const last = Math.max(...list.map((m) => new Date(m.scheduled_at!).getTime())) + dur;
    planned = Math.max(planned, last);
    projected = Math.max(projected, last + (c.state === "done" ? 0 : c.delay * MIN));
  }
  // Matchs sans terrain (phase finale non encore placée) : on garde la fin du planning.
  for (const m of all) if (m.scheduled_at && !m.court_id) planned = Math.max(planned, new Date(m.scheduled_at).getTime() + dur);
  return {
    plannedEnd: planned ? new Date(planned) : null,
    projectedEnd: projected || planned ? new Date(Math.max(projected, planned)) : null,
    maxDelay: Math.max(0, ...courts.filter((c) => c.state !== "done").map((c) => c.delay)),
    done: all.filter((m) => m.status === "finished").length,
    total: all.length,
    live: all.filter((m) => m.status === "live").length,
  };
}

export type InsightTone = "danger" | "warn" | "info" | "ok";

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  detail?: string;
  /** Lien vers l'écran qui permet d'agir. */
  href?: string;
  cta?: string;
  /** Action proposée en un geste : décaler un match et les suivants de son terrain. */
  shift?: { matchId: string; courtId: string; scheduledAt: string; minutes: number };
}

const TONE_ORDER: Record<InsightTone, number> = { danger: 0, warn: 1, info: 2, ok: 3 };

/** Analyse le tournoi et renvoie les points d'attention, les plus urgents d'abord. */
export function tournamentInsights(b: TournamentBundle, now = Date.now(), r: ResolveResult = resolveTournament(b, new Date(now))): Insight[] {
  const v = new View(b);
  const t = b.tournament;
  const L = t.rules.labels;
  const base = `/t/${t.slug}`;
  const out: Insight[] = [];
  const courts = courtStatuses(b, now);
  const all = v.playable();
  const vs = (m: Match) => `${v.home(m)} – ${v.away(m)}`;

  // Hors du jour du tournoi : pas d'alerte de retard, mais les matchs restés ouverts sont signalés.
  if (!v.isMatchday(now) && now > new Date(t.start_at).getTime()) {
    const open = all.filter((m) => m.status !== "finished");
    if (open.length)
      out.push({
        id: "past-open",
        tone: "warn",
        title: `${open.length} match${open.length > 1 ? "s" : ""} jamais terminé${open.length > 1 ? "s" : ""}`,
        detail: "La journée du tournoi est passée mais des scores n'ont pas été validés. Les retards ne sont plus calculés.",
        href: `${base}/match/${(open.find((m) => m.status === "live") ?? open[0]).id}`,
        cta: "Valider les scores",
      });
  }

  // Avant le coup d'envoi
  const start = new Date(t.start_at).getTime();
  if (now < start && all.every((m) => m.status === "scheduled")) {
    const mins = Math.round((start - now) / MIN);
    out.push({
      id: "kickoff",
      tone: "info",
      title: mins <= 90 ? `Coup d'envoi dans ${mins} min` : `Coup d'envoi à ${fmtTime(t.start_at, t.timezone)}`,
      detail: `Transmettez à chaque arbitre le code de son ${L.court} avant le premier match.`,
      href: `${base}/admin/regles`,
      cta: "Codes arbitres",
    });
  }

  for (const c of courts) {
    // Match en cours bien au-delà de sa durée : score probablement oublié.
    if (c.live && c.elapsed !== null) {
      const over = c.elapsed - t.match_duration;
      if (c.elapsed >= 2 * t.match_duration && c.elapsed >= t.match_duration + 10) {
        out.push({
          id: `stale-${c.live.id}`,
          tone: "danger",
          title: `${c.name} : score à valider ?`,
          detail: `${vs(c.live)} est en cours depuis ${c.elapsed} min (prévu ${t.match_duration}). Le match est peut-être terminé sans avoir été validé.`,
          href: `${base}/match/${c.live.id}`,
          cta: "Ouvrir la saisie",
        });
      } else if (over >= 5) {
        out.push({
          id: `over-${c.live.id}`,
          tone: "warn",
          title: `${c.name} : match prolongé de ${over} min`,
          detail: `${vs(c.live)} déborde de sa durée prévue.`,
          href: `${base}/match/${c.live.id}`,
          cta: "Voir le match",
        });
      }
    }
    // Retard projeté du prochain match, avec décalage proposé.
    if (c.next?.scheduled_at && c.delay >= 5) {
      const minutes = Math.ceil(c.delay / 5) * 5;
      out.push({
        id: `late-${c.courtId}`,
        tone: c.delay >= 15 ? "danger" : "warn",
        title: `${c.name} : ${c.delay} min de retard${c.live ? " prévu" : ""}`,
        detail: `Prochain : ${vs(c.next)}, prévu à ${fmtTime(c.next.scheduled_at, t.timezone)}. Décaler de ${minutes} min réaligne le planning du ${L.court}.`,
        shift: { matchId: c.next.id, courtId: c.courtId, scheduledAt: c.next.scheduled_at, minutes },
      });
    }
  }

  // Terrain libre alors qu'un autre accumule du retard.
  const worst = courts.filter((c) => c.delay >= 10).sort((a, c) => c.delay - a.delay)[0];
  if (worst) {
    for (const c of courts.filter((x) => x.state === "idle" && x.next?.scheduled_at)) {
      out.push({
        id: `idle-${c.courtId}`,
        tone: "info",
        title: `${c.name} libre jusqu'à ${fmtTime(c.next!.scheduled_at, t.timezone)}`,
        detail: `${worst.name} a ${worst.delay} min de retard : déplacez-y un de ses matchs pour rattraper le temps perdu.`,
        href: `${base}/admin/planning`,
        cta: "Ouvrir le planning",
      });
    }
  }

  out.push(...conflicts(b, v));

  // Avancement des poules et de la phase finale
  if (t.format === "pools_knockout") {
    const poolLeft = all.filter((m) => m.phase === "pool" && m.status !== "finished").length;
    if (!r.poolsComplete && poolLeft > 0 && poolLeft <= Math.max(2, b.courts.length * 2)) {
      out.push({
        id: "pools-left",
        tone: "info",
        title: `Plus que ${poolLeft} match${poolLeft > 1 ? "s" : ""} de poule`,
        detail: "La phase finale se remplira automatiquement dès le dernier score validé.",
      });
    }
    const ko = all.filter((m) => m.phase === "knockout");
    if (r.poolsComplete && ko.length && ko.every((m) => m.status === "scheduled")) {
      out.push({ id: "ko-ready", tone: "ok", title: "Phase finale prête", detail: "Les qualifiés ont été placés dans le tableau.", href: `${base}?v=tableau`, cta: "Voir le tableau" });
    }
  }

  // Égalités tranchées au tirage au sort dans une poule terminée
  for (const p of b.pools) {
    const done = all.filter((m) => m.pool_id === p.id).every((m) => m.status === "finished");
    const lot = (r.standings.get(p.id) ?? []).filter((row) => row.byLot && row.played > 0);
    if (done && lot.length) {
      out.push({
        id: `lot-${p.id}`,
        tone: "info",
        title: `Poule ${p.name} : égalité parfaite`,
        detail: `${lot.map((x) => x.name).join(", ")} départagé${lot.length > 1 ? "s" : ""} par tirage au sort.`,
        href: `${base}?v=classements`,
        cta: "Classement",
      });
    }
  }

  const withdrawn = b.teams.filter((x) => x.withdrawn);
  if (withdrawn.length) {
    out.push({
      id: "withdrawn",
      tone: "info",
      title: `Abandon : ${withdrawn.map((x) => x.name).join(", ")}`,
      detail: "Leurs matchs restants sont perdus par forfait.",
      href: `${base}/admin/equipes`,
      cta: "Équipes",
    });
  }

  if (all.length && all.every((m) => m.status === "finished")) {
    const champ = champion(b);
    out.push({ id: "finished", tone: "ok", title: "Tournoi terminé", detail: champ ? `Vainqueur : ${champ}. Bravo à toutes les équipes !` : "Tous les résultats sont saisis." });
  }

  return out.sort((a, c) => TONE_ORDER[a.tone] - TONE_ORDER[c.tone]);
}

/** Chevauchements d'une équipe ou d'un terrain, et repos insuffisant, sur les matchs non joués. */
function conflicts(b: TournamentBundle, v: View): Insight[] {
  const t = b.tournament;
  const dur = t.match_duration * MIN;
  const open = v.playable().filter((m) => m.status !== "finished" && m.scheduled_at);
  const out: Insight[] = [];
  const seen = new Set<string>();
  const href = `/t/${t.slug}/admin/planning`;

  const check = (key: string, list: Match[], who: string, kind: "team" | "court") => {
    const sorted = [...list].sort(byTime);
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1];
      const c = sorted[i];
      const gap = (new Date(c.scheduled_at!).getTime() - (new Date(a.scheduled_at!).getTime() + dur)) / MIN;
      const id = `${kind}-${key}-${a.id}-${c.id}`;
      if (seen.has(id)) continue;
      if (gap < 0) {
        seen.add(id);
        out.push({
          id,
          tone: "danger",
          title: kind === "team" ? `Conflit : ${who} joue deux matchs en même temps` : `Conflit sur ${who}`,
          detail: `${a.label ?? "Match"} à ${fmtTime(a.scheduled_at, t.timezone)} et ${c.label ?? "match"} à ${fmtTime(c.scheduled_at, t.timezone)} se chevauchent.`,
          href,
          cta: "Corriger le planning",
        });
      } else if (kind === "team" && t.min_rest > 0 && gap < t.min_rest) {
        seen.add(id);
        out.push({
          id,
          tone: "warn",
          title: `Repos court pour ${who}`,
          detail: `${Math.round(gap)} min entre ${fmtTime(a.scheduled_at, t.timezone)} et ${fmtTime(c.scheduled_at, t.timezone)} (minimum ${t.min_rest} min).`,
          href,
          cta: "Planning",
        });
      }
    }
  };

  for (const team of b.teams) {
    if (team.withdrawn) continue;
    check(
      team.id,
      open.filter((m) => m.home_team_id === team.id || m.away_team_id === team.id),
      team.name,
      "team",
    );
  }
  for (const c of b.courts)
    check(
      c.id,
      open.filter((m) => m.court_id === c.id),
      c.name,
      "court",
    );
  return out.slice(0, 6);
}

/** Nom du vainqueur : finale gagnée, ou 1er de l'unique poule. */
export function champion(b: TournamentBundle): string | null {
  const ko = b.matches.filter((m) => m.phase === "knockout");
  const teams = new Map(b.teams.map((x) => [x.id, x.name]));
  if (ko.length) {
    const rounds = Math.max(...ko.map((m) => m.bracket_round ?? 0));
    const final = ko.find((m) => m.bracket_round === rounds && (m.bracket_slot ?? 0) === 0);
    return final?.winner_team_id ? (teams.get(final.winner_team_id) ?? null) : null;
  }
  if (b.pools.length === 1) {
    const r = resolveTournament(b);
    return r.standings.get(b.pools[0].id)?.[0]?.name ?? null;
  }
  return null;
}
