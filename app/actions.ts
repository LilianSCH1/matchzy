"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { buildTournament, slugify, validateInput, type TournamentInput } from "@/lib/build";
import { cleanRules, safeNext, validateRules } from "@/lib/rules";
import { clearReferee, isOrganizer, loginOrganizer, logout, refereeCourt, setReferee } from "@/lib/server/auth";
import { getTournament, toRow } from "@/lib/server/data";
import { db, withTournamentLock, type Q } from "@/lib/server/db";
import { createDemo } from "@/lib/server/demo";
import { recompute, saveBuiltTournament, updateMatch } from "@/lib/server/persist";
import { clearLimits, clientIp, hitLimits } from "@/lib/server/ratelimit";
import { forfeitScore, setsWon, validateResult } from "@/lib/scoring";
import type { Match, SetScore, Side, SportRules, Tournament } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });
const OK: ActionResult = { ok: true };

async function requireOrganizer() {
  if (!(await isOrganizer())) throw new Error("Accès réservé à l'organisateur.");
}

/** Invalide le cache des données (voir lib/server/page.ts) et les pages concernées. */
function refresh(slug?: string) {
  if (slug) {
    revalidateTag(`t:${slug}`);
    revalidatePath(`/t/${slug}`, "layout");
  } else {
    revalidateTag("tournaments");
    revalidatePath("/", "layout");
  }
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

const tooMany = (min: number) => `Trop de tentatives. Réessayez dans ${min} min.`;

// ---------------------------------------------------------------- Accès

export async function loginAction(_: unknown, form: FormData): Promise<{ error?: string }> {
  const key = `org:${await clientIp()}`;
  const wait = await hitLimits([{ key, max: 8, windowSec: 15 * 60 }]);
  if (wait) return { error: tooMany(wait) };
  const ok = await loginOrganizer(String(form.get("password") ?? ""));
  if (!ok) return { error: "Mot de passe incorrect." };
  await clearLimits([key]);
  redirect(safeNext(form.get("next")));
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
  // Par adresse IP, et pour tout le tournoi (contre un essai des codes depuis plusieurs adresses).
  const ipKey = `ref:${t.id}:${await clientIp()}`;
  const wait = await hitLimits([
    { key: ipKey, max: 10, windowSec: 15 * 60 },
    { key: `ref:${t.id}`, max: 200, windowSec: 60 * 60 },
  ]);
  if (wait) return { error: tooMany(wait) };
  if (!/^\d{4,8}$/.test(code)) return { error: "Code inconnu." };
  const [row] = await db()<{ court_id: string }[]>`select court_id from court_codes where tournament_id = ${t.id} and code = ${code}`;
  if (!row) return { error: "Code inconnu." };
  await clearLimits([ipKey]);
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
    const err = validateInput(input) ?? validateRules(input.rules);
    if (err) return { error: err };
    const built = buildTournament({ ...input, rules: cleanRules(input.rules) });
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
    const rows = await db()<{ slug: string }[]>`delete from tournaments where id = ${id} returning slug`;
    if (!rows.length) return fail("Ce tournoi n'existe plus (déjà supprimé ?).");
    refresh(rows[0].slug);
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

async function loadMatch(matchId: string, sql: Q) {
  const [m] = await sql<Match[]>`select * from matches where id = ${matchId}`;
  if (!m) throw new Error("Match introuvable.");
  const t = (await getTournament({ id: m.tournament_id }, sql)) as Tournament;
  return { m, t };
}

async function requireScorer(m: Pick<Match, "tournament_id" | "court_id">) {
  if (await isOrganizer()) return;
  const court = await refereeCourt(m.tournament_id);
  if (!court || court !== m.court_id) throw new Error("Vous n'êtes pas arbitre de ce terrain.");
}

/**
 * Vérifie les droits, puis exécute `fn` dans une transaction verrouillée sur le tournoi,
 * avec l'état du match relu à l'intérieur de la transaction.
 */
async function onMatch(
  matchId: string,
  access: "scorer" | "organizer",
  fn: (sql: Q, m: Match, t: Tournament) => Promise<ActionResult | void>,
): Promise<ActionResult> {
  return wrap(async () => {
    if (access === "organizer") await requireOrganizer();
    const [head] = await db()<Pick<Match, "tournament_id" | "court_id">[]>`select tournament_id, court_id from matches where id = ${matchId}`;
    if (!head) return fail("Match introuvable.");
    if (access === "scorer") await requireScorer(head);
    let slug = "";
    const r = await withTournamentLock(head.tournament_id, async (sql) => {
      const { m, t } = await loadMatch(matchId, sql);
      slug = t.slug;
      return fn(sql, m, t);
    });
    refresh(slug);
    return r;
  });
}

export interface ScorePayload {
  home_score: number | null;
  away_score: number | null;
  sets: SetScore[] | null;
  shootout: SetScore | null;
}

function normalizeScore(p: ScorePayload, rules: SportRules): ScorePayload {
  const clean = (n: unknown) => {
    const x = Number(n);
    return n === null || n === undefined || !Number.isFinite(x) ? null : Math.min(999, Math.max(0, Math.round(x)));
  };
  if (rules.scoreType === "sets") {
    const sets = (Array.isArray(p.sets) ? p.sets : []).slice(0, 9).map((s) => ({ home: clean(s?.home) ?? 0, away: clean(s?.away) ?? 0 }));
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
  return onMatch(matchId, "scorer", async (sql, m, t) => {
    if (!m.home_team_id || !m.away_team_id) return fail("Les équipes de ce match ne sont pas encore connues.");
    if (m.status !== "scheduled") return;
    const init: Partial<Match> = t.rules.scoreType === "sets" ? { home_score: 0, away_score: 0, sets: [{ home: 0, away: 0 }] } : { home_score: 0, away_score: 0 };
    await updateMatch(matchId, { status: "live", started_at: now(), ...init }, sql);
  });
}

/** Score en direct (match en cours). */
export async function liveScoreAction(matchId: string, payload: ScorePayload): Promise<ActionResult> {
  return onMatch(matchId, "scorer", async (sql, m, t) => {
    if (m.status === "finished") return fail("Match terminé : utilisez la correction.");
    if (!m.home_team_id || !m.away_team_id) return fail("Les équipes de ce match ne sont pas encore connues.");
    await updateMatch(matchId, { ...normalizeScore(payload, t.rules), status: "live", started_at: m.started_at ?? now() }, sql);
  });
}

/** Valide (ou corrige) le résultat final et recalcule tout ce qui en dépend. */
export async function finishMatchAction(matchId: string, payload: ScorePayload): Promise<ActionResult> {
  return onMatch(matchId, "scorer", async (sql, m, t) => {
    if (!m.home_team_id || !m.away_team_id) return fail("Les équipes de ce match ne sont pas encore connues.");
    const s = normalizeScore(payload, t.rules);
    const err = validateResult({ ...s, forfeit: null, phase: m.phase }, t.rules);
    if (err) return fail(err);
    const tied = s.home_score === s.away_score;
    await updateMatch(
      matchId,
      {
        ...s,
        shootout: m.phase === "knockout" && tied ? s.shootout : null,
        forfeit: null,
        status: "finished",
        started_at: m.started_at ?? now(),
        finished_at: now(),
      },
      sql,
    );
    await recompute(t, sql);
  });
}

export async function forfeitAction(matchId: string, side: Side | "both"): Promise<ActionResult> {
  if (side !== "home" && side !== "away" && side !== "both") return fail("Forfait invalide.");
  return onMatch(matchId, "scorer", async (sql, m, t) => {
    if (!m.home_team_id || !m.away_team_id) return fail("Les équipes de ce match ne sont pas encore connues.");
    await updateMatch(matchId, { ...forfeitScore(side, t.rules), shootout: null, forfeit: side, status: "finished", finished_at: now() }, sql);
    await recompute(t, sql);
  });
}

/** Remet un match à « Programmé » (organisateur). */
export async function resetMatchAction(matchId: string): Promise<ActionResult> {
  return onMatch(matchId, "organizer", async (sql, _m, t) => {
    await updateMatch(matchId, CLEARED, sql);
    await recompute(t, sql);
  });
}

// ---------------------------------------------------------------- Planning

export async function moveMatchAction(matchId: string, scheduledAt: string, courtId: string, cascade: boolean): Promise<ActionResult> {
  return onMatch(matchId, "organizer", async (sql, m, t) => {
    const newTime = new Date(scheduledAt);
    if (Number.isNaN(newTime.getTime())) return fail("Horaire invalide.");
    const [court] = await sql`select 1 from courts where id = ${courtId} and tournament_id = ${t.id}`;
    if (!court) return fail("Terrain introuvable.");
    if (cascade && m.scheduled_at && m.court_id === courtId) {
      // Décale aussi tous les matchs suivants (non terminés) du même terrain
      const delta = Math.round((newTime.getTime() - new Date(m.scheduled_at).getTime()) / 1000);
      await sql`update matches set scheduled_at = scheduled_at + make_interval(secs => ${delta})
                where tournament_id = ${t.id} and court_id = ${courtId} and scheduled_at > ${m.scheduled_at}
                  and status <> 'finished' and id <> ${matchId}`;
    }
    await updateMatch(matchId, { scheduled_at: newTime.toISOString(), court_id: courtId }, sql);
  });
}

export async function swapMatchesAction(a: string, b: string): Promise<ActionResult> {
  if (a === b) return fail("Choisissez deux matchs différents.");
  return onMatch(a, "organizer", async (sql, ma) => {
    const [mb] = await sql<Match[]>`select * from matches where id = ${b} and tournament_id = ${ma.tournament_id}`;
    if (!mb) return fail("Match introuvable.");
    if (ma.status !== "scheduled" || mb.status !== "scheduled") return fail("Seuls des matchs programmés peuvent être échangés.");
    await sql`update matches set scheduled_at = ${mb.scheduled_at}, court_id = ${mb.court_id} where id = ${a}`;
    await sql`update matches set scheduled_at = ${ma.scheduled_at}, court_id = ${ma.court_id} where id = ${b}`;
  });
}

// ---------------------------------------------------------------- Équipes & règles

/** Exécute `fn` dans une transaction verrouillée sur le tournoi de l'équipe (organisateur). */
async function onTeam(teamId: string, fn: (sql: Q, t: Tournament) => Promise<ActionResult | void>): Promise<ActionResult> {
  return wrap(async () => {
    await requireOrganizer();
    const [team] = await db()<{ tournament_id: string }[]>`select tournament_id from teams where id = ${teamId}`;
    if (!team) return fail("Équipe introuvable.");
    let slug = "";
    const r = await withTournamentLock(team.tournament_id, async (sql) => {
      const t = (await getTournament({ id: team.tournament_id }, sql)) as Tournament;
      slug = t.slug;
      return fn(sql, t);
    });
    refresh(slug);
    return r;
  });
}

export async function withdrawTeamAction(teamId: string, withdrawn: boolean): Promise<ActionResult> {
  return onTeam(teamId, async (sql, t) => {
    await sql`update teams set withdrawn = ${!!withdrawn} where id = ${teamId}`;
    if (!withdrawn) {
      // Réintégration : on annule les forfaits automatiques de l'équipe
      const cleared = toRow(CLEARED);
      await sql`update matches set ${sql(cleared, Object.keys(cleared))}
                where tournament_id = ${t.id}
                  and ((home_team_id = ${teamId} and forfeit in ('home', 'both')) or (away_team_id = ${teamId} and forfeit in ('away', 'both')))`;
    }
    await recompute(t, sql);
  });
}

export async function updateTeamAction(teamId: string, fields: { name?: string; fair_play?: number }): Promise<ActionResult> {
  return onTeam(teamId, async (sql, t) => {
    if (fields.name !== undefined) {
      const name = String(fields.name).trim();
      if (!name) return fail("Nom vide.");
      if (name.length > 80) return fail("Nom trop long (80 caractères au plus).");
      await sql`update teams set name = ${name} where id = ${teamId}`;
    }
    if (fields.fair_play !== undefined) {
      const fp = Math.round(Number(fields.fair_play));
      if (!Number.isFinite(fp)) return fail("Points de fair-play invalides.");
      await sql`update teams set fair_play = ${Math.min(999, Math.max(0, fp))} where id = ${teamId}`;
    }
    await recompute(t, sql);
  });
}

export async function updateTournamentRulesAction(tournamentId: string, rules: SportRules): Promise<ActionResult> {
  return wrap(async () => {
    await requireOrganizer();
    const err = validateRules(rules);
    if (err) return fail(err);
    const clean = cleanRules(rules);
    const slug = await withTournamentLock(tournamentId, async (sql) => {
      const [t] = await sql<Tournament[]>`update tournaments set rules = ${sql.json(clean as never)} where id = ${tournamentId} returning *`;
      if (!t) return null;
      await recompute(t, sql);
      return t.slug;
    });
    if (!slug) return fail("Tournoi introuvable.");
    refresh(slug);
  });
}

export async function renameCourtAction(courtId: string, name: string): Promise<ActionResult> {
  return wrap(async () => {
    await requireOrganizer();
    const n = String(name).trim();
    if (!n) return fail("Nom vide.");
    if (n.length > 40) return fail("Nom trop long (40 caractères au plus).");
    const [row] = await db()<{ slug: string }[]>`update courts c set name = ${n} from tournaments t
                                                 where c.id = ${courtId} and t.id = c.tournament_id returning t.slug`;
    if (!row) return fail("Terrain introuvable.");
    refresh(row.slug);
  });
}

export async function saveSportRulesAction(id: string | null, rules: SportRules, name?: string): Promise<ActionResult> {
  return wrap(async () => {
    await requireOrganizer();
    const n = (name ?? "").trim();
    if (!n) return fail("Nom vide.");
    if (n.length > 60) return fail("Nom trop long (60 caractères au plus).");
    const err = validateRules(rules);
    if (err) return fail(err);
    const clean = cleanRules(rules);
    const sql = db();
    if (id) await sql`update sports set name = ${n}, rules = ${sql.json(clean as never)} where id = ${id}`;
    else {
      const slug = `${slugify(n) || "sport"}-${Math.random().toString(36).slice(2, 5)}`;
      await sql`insert into sports (slug, name, rules, is_preset) values (${slug}, ${n}, ${sql.json(clean as never)}, false)`;
    }
    revalidatePath("/sports");
  });
}
