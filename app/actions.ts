"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildTournament, slugify, validateInput, type TournamentInput } from "@/lib/build";
import { clearReferee, isOrganizer, loginOrganizer, logout, refereeCourt, setReferee } from "@/lib/server/auth";
import { getTournament } from "@/lib/server/data";
import { db } from "@/lib/server/db";
import { createDemo } from "@/lib/server/demo";
import { recompute, saveBuiltTournament, updateMatch } from "@/lib/server/persist";
import { forfeitScore, setsWon, validateResult } from "@/lib/scoring";
import type { Match, SetScore, Side, SportRules, Tournament } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });
const OK: ActionResult = { ok: true };

async function requireOrganizer() {
  if (!(await isOrganizer())) throw new Error("Accès réservé à l'organisateur.");
}

function refresh(slug?: string) {
  if (slug) revalidatePath(`/t/${slug}`, "layout");
  else revalidatePath("/", "layout");
}

async function wrap(fn: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    return (await fn()) ?? OK;
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

const CLEARED: Partial<Match> = {
  status: "scheduled",
  home_score: null,
  away_score: null,
  sets: null,
  shootout: null,
  forfeit: null,
  winner_team_id: null,
  started_at: null,
  finished_at: null,
};

// ---------------------------------------------------------------- Accès

export async function loginAction(_: unknown, form: FormData): Promise<{ error?: string }> {
  const ok = await loginOrganizer(String(form.get("password") ?? ""));
  if (!ok) return { error: "Mot de passe incorrect." };
  const next = String(form.get("next") ?? "/");
  redirect(next.startsWith("/") ? next : "/");
}

export async function logoutAction() {
  await logout();
  redirect("/");
}

export async function refereeLoginAction(_: unknown, form: FormData): Promise<{ error?: string }> {
  const slug = String(form.get("slug"));
  const code = String(form.get("code") ?? "").trim();
  const t = await getTournament({ slug });
  if (!t) return { error: "Tournoi introuvable." };
  const [row] = await db()<{ court_id: string }[]>`select court_id from court_codes where tournament_id = ${t.id} and code = ${code}`;
  if (!row) return { error: "Code inconnu." };
  await setReferee(t.id, row.court_id);
  redirect(`/t/${slug}/arbitre`);
}

export async function refereeLogoutAction(slug: string, tournamentId: string) {
  await clearReferee(tournamentId);
  redirect(`/t/${slug}/arbitre`);
}

// ---------------------------------------------------------------- Création

export async function createTournamentAction(input: TournamentInput): Promise<{ slug?: string; error?: string }> {
  try {
    await requireOrganizer();
    const err = validateInput(input);
    if (err) return { error: err };
    const built = buildTournament(input);
    await saveBuiltTournament(built);
    refresh();
    return { slug: built.tournament.slug };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

export async function createDemoAction(): Promise<{ slug?: string; count?: number; error?: string }> {
  try {
    await requireOrganizer();
    const built = await createDemo();
    refresh();
    return { slug: built[0]?.tournament.slug, count: built.length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Impossible de créer la démo." };
  }
}

export async function deleteTournamentAction(id: string): Promise<ActionResult> {
  return wrap(async () => {
    await requireOrganizer();
    const rows = await db()`delete from tournaments where id = ${id} returning id`;
    if (!rows.length) return fail("Ce tournoi n'existe plus (déjà supprimé ?).");
    refresh();
  });
}

/** Supprime tous les tournois (et, par cascade, équipes, matchs et résultats). Les sports sont conservés. */
export async function deleteAllTournamentsAction(): Promise<ActionResult & { count?: number }> {
  try {
    await requireOrganizer();
    const rows = await db()`delete from tournaments returning id`;
    refresh();
    return { ok: true, count: rows.length };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

// ---------------------------------------------------------------- Scores

async function loadMatch(matchId: string) {
  const [m] = await db()<Match[]>`select * from matches where id = ${matchId}`;
  if (!m) throw new Error("Match introuvable.");
  const t = (await getTournament({ id: m.tournament_id })) as Tournament;
  return { m, t };
}

async function requireScorer(m: Match) {
  if (await isOrganizer()) return;
  const court = await refereeCourt(m.tournament_id);
  if (!court || court !== m.court_id) throw new Error("Vous n'êtes pas arbitre de ce terrain.");
}

export interface ScorePayload {
  home_score: number | null;
  away_score: number | null;
  sets: SetScore[] | null;
  shootout: SetScore | null;
}

function normalizeScore(p: ScorePayload, rules: SportRules): ScorePayload {
  const clean = (n: number | null) => (n === null || Number.isNaN(n) ? null : Math.max(0, Math.round(n)));
  if (rules.scoreType === "sets") {
    const sets = (p.sets ?? []).map((s) => ({ home: clean(s.home) ?? 0, away: clean(s.away) ?? 0 }));
    const w = setsWon(sets, rules);
    return { home_score: w.home, away_score: w.away, sets, shootout: null };
  }
  return {
    home_score: clean(p.home_score) ?? 0,
    away_score: clean(p.away_score) ?? 0,
    sets: null,
    shootout: p.shootout ? { home: clean(p.shootout.home) ?? 0, away: clean(p.shootout.away) ?? 0 } : null,
  };
}

const now = () => new Date().toISOString();

export async function startMatchAction(matchId: string): Promise<ActionResult> {
  return wrap(async () => {
    const { m, t } = await loadMatch(matchId);
    await requireScorer(m);
    if (!m.home_team_id || !m.away_team_id) return fail("Les équipes de ce match ne sont pas encore connues.");
    if (m.status !== "scheduled") return;
    const init: Partial<Match> = t.rules.scoreType === "sets" ? { home_score: 0, away_score: 0, sets: [{ home: 0, away: 0 }] } : { home_score: 0, away_score: 0 };
    await updateMatch(matchId, { status: "live", started_at: now(), ...init });
    refresh(t.slug);
  });
}

/** Score en direct (match en cours). */
export async function liveScoreAction(matchId: string, payload: ScorePayload): Promise<ActionResult> {
  return wrap(async () => {
    const { m, t } = await loadMatch(matchId);
    await requireScorer(m);
    if (m.status === "finished") return fail("Match terminé : utilisez la correction.");
    await updateMatch(matchId, { ...normalizeScore(payload, t.rules), status: "live", started_at: m.started_at ?? now() });
    refresh(t.slug);
  });
}

/** Valide (ou corrige) le résultat final et recalcule tout ce qui en dépend. */
export async function finishMatchAction(matchId: string, payload: ScorePayload): Promise<ActionResult> {
  return wrap(async () => {
    const { m, t } = await loadMatch(matchId);
    await requireScorer(m);
    if (!m.home_team_id || !m.away_team_id) return fail("Les équipes de ce match ne sont pas encore connues.");
    const s = normalizeScore(payload, t.rules);
    const err = validateResult({ ...s, forfeit: null, phase: m.phase }, t.rules);
    if (err) return fail(err);
    const tied = s.home_score === s.away_score;
    await updateMatch(matchId, {
      ...s,
      shootout: m.phase === "knockout" && tied ? s.shootout : null,
      forfeit: null,
      status: "finished",
      started_at: m.started_at ?? now(),
      finished_at: now(),
    });
    await recompute(t.id);
    refresh(t.slug);
  });
}

export async function forfeitAction(matchId: string, side: Side | "both"): Promise<ActionResult> {
  return wrap(async () => {
    const { m, t } = await loadMatch(matchId);
    await requireScorer(m);
    if (!m.home_team_id || !m.away_team_id) return fail("Les équipes de ce match ne sont pas encore connues.");
    await updateMatch(matchId, { ...forfeitScore(side, t.rules), forfeit: side, status: "finished", finished_at: now() });
    await recompute(t.id);
    refresh(t.slug);
  });
}

/** Remet un match à « Programmé » (organisateur). */
export async function resetMatchAction(matchId: string): Promise<ActionResult> {
  return wrap(async () => {
    await requireOrganizer();
    const { t } = await loadMatch(matchId);
    await updateMatch(matchId, CLEARED);
    await recompute(t.id);
    refresh(t.slug);
  });
}

// ---------------------------------------------------------------- Planning

export async function moveMatchAction(matchId: string, scheduledAt: string, courtId: string, cascade: boolean): Promise<ActionResult> {
  return wrap(async () => {
    await requireOrganizer();
    const { m, t } = await loadMatch(matchId);
    const newTime = new Date(scheduledAt);
    if (Number.isNaN(newTime.getTime())) return fail("Horaire invalide.");
    const sql = db();
    if (cascade && m.scheduled_at && m.court_id === courtId) {
      // Décale aussi tous les matchs suivants (non terminés) du même terrain
      const delta = Math.round((newTime.getTime() - new Date(m.scheduled_at).getTime()) / 1000);
      await sql`update matches set scheduled_at = scheduled_at + make_interval(secs => ${delta})
                where court_id = ${courtId} and scheduled_at > ${m.scheduled_at} and status <> 'finished'`;
    }
    await updateMatch(matchId, { scheduled_at: newTime.toISOString(), court_id: courtId });
    refresh(t.slug);
  });
}

export async function swapMatchesAction(a: string, b: string): Promise<ActionResult> {
  return wrap(async () => {
    await requireOrganizer();
    const { m: ma, t } = await loadMatch(a);
    const { m: mb } = await loadMatch(b);
    await db().begin(async (sql) => {
      await sql`update matches set scheduled_at = ${mb.scheduled_at}, court_id = ${mb.court_id} where id = ${a}`;
      await sql`update matches set scheduled_at = ${ma.scheduled_at}, court_id = ${ma.court_id} where id = ${b}`;
    });
    refresh(t.slug);
  });
}

// ---------------------------------------------------------------- Équipes & règles

async function tournamentOfTeam(teamId: string) {
  const [team] = await db()<{ tournament_id: string }[]>`select tournament_id from teams where id = ${teamId}`;
  if (!team) throw new Error("Équipe introuvable.");
  return (await getTournament({ id: team.tournament_id })) as Tournament;
}

export async function withdrawTeamAction(teamId: string, withdrawn: boolean): Promise<ActionResult> {
  return wrap(async () => {
    await requireOrganizer();
    const t = await tournamentOfTeam(teamId);
    const sql = db();
    await sql`update teams set withdrawn = ${withdrawn} where id = ${teamId}`;
    if (!withdrawn) {
      // Réintégration : on annule les forfaits automatiques de l'équipe
      await sql`update matches set status = 'scheduled', forfeit = null, home_score = null, away_score = null, sets = null,
                  winner_team_id = null, finished_at = null
                where tournament_id = ${t.id}
                  and ((home_team_id = ${teamId} and forfeit in ('home', 'both')) or (away_team_id = ${teamId} and forfeit in ('away', 'both')))`;
    }
    await recompute(t.id);
    refresh(t.slug);
  });
}

export async function updateTeamAction(teamId: string, fields: { name?: string; fair_play?: number }): Promise<ActionResult> {
  return wrap(async () => {
    await requireOrganizer();
    const t = await tournamentOfTeam(teamId);
    const sql = db();
    if (fields.name !== undefined) {
      if (!fields.name.trim()) return fail("Nom vide.");
      await sql`update teams set name = ${fields.name.trim()} where id = ${teamId}`;
    }
    if (fields.fair_play !== undefined) await sql`update teams set fair_play = ${Math.max(0, Math.round(fields.fair_play))} where id = ${teamId}`;
    await recompute(t.id);
    refresh(t.slug);
  });
}

export async function updateTournamentRulesAction(tournamentId: string, rules: SportRules): Promise<ActionResult> {
  return wrap(async () => {
    await requireOrganizer();
    const sql = db();
    const [t] = await sql<{ slug: string }[]>`update tournaments set rules = ${sql.json(rules as never)} where id = ${tournamentId} returning slug`;
    if (!t) return fail("Tournoi introuvable.");
    await recompute(tournamentId);
    refresh(t.slug);
  });
}

export async function renameCourtAction(courtId: string, name: string): Promise<ActionResult> {
  return wrap(async () => {
    await requireOrganizer();
    if (!name.trim()) return fail("Nom vide.");
    await db()`update courts set name = ${name.trim()} where id = ${courtId}`;
    refresh();
  });
}

export async function saveSportRulesAction(id: string | null, rules: SportRules, name?: string): Promise<ActionResult> {
  return wrap(async () => {
    await requireOrganizer();
    const n = (name ?? "").trim();
    if (!n) return fail("Nom vide.");
    const sql = db();
    if (id) await sql`update sports set name = ${n}, rules = ${sql.json(rules as never)} where id = ${id}`;
    else {
      const slug = `${slugify(n) || "sport"}-${Math.random().toString(36).slice(2, 5)}`;
      await sql`insert into sports (slug, name, rules, is_preset) values (${slug}, ${n}, ${sql.json(rules as never)}, false)`;
    }
    revalidatePath("/sports");
  });
}
