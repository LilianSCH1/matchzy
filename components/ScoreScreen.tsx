"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  finishMatchAction,
  forfeitAction,
  liveScoreAction,
  resetMatchAction,
  startMatchAction,
  type ActionResult,
  type ScorePayload,
} from "@/app/actions";
import { outcome, scoreText, setsWon, setTarget, setWinner, validateResult } from "@/lib/scoring";
import type { Match, SetScore, Side, SportRules } from "@/lib/types";
import { IconCheck, IconFlag, IconPencil, IconPlay, IconPlus } from "./Icons";
import { LiveBadge } from "./MatchRow";
import { ErrorText } from "./ui";

interface Props {
  match: Match;
  rules: SportRules;
  homeName: string;
  awayName: string;
  isOrganizer: boolean;
  back: string;
}

export function ScoreScreen({ match: m, rules, homeName, awayName, isOrganizer, back }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(m.status === "live");
  const [home, setHome] = useState(m.home_score ?? 0);
  const [away, setAway] = useState(m.away_score ?? 0);
  const [sets, setSets] = useState<SetScore[]>(m.sets?.length ? m.sets : [{ home: 0, away: 0 }]);
  const [active, setActive] = useState(Math.max(0, (m.sets?.length ?? 1) - 1));
  const [shootout, setShootout] = useState<SetScore>(m.shootout ?? { home: 0, away: 0 });
  const [showForfeit, setShowForfeit] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSets = rules.scoreType === "sets";
  const teamsKnown = !!m.home_team_id && !!m.away_team_id;

  const payload = (): ScorePayload => ({
    home_score: home,
    away_score: away,
    sets: isSets ? sets : null,
    shootout: m.phase === "knockout" && home === away && !isSets ? shootout : null,
  });

  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error);
      else {
        setError(null);
        after?.();
        router.refresh();
      }
    });

  // Synchronisation du score en direct (match en cours uniquement)
  const live = m.status === "live" && editing;
  const payloadKey = JSON.stringify(payload());
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!live) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await liveScoreAction(m.id, JSON.parse(payloadKey));
      if (!r.ok) setError(r.error);
    }, 500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [payloadKey, live, m.id]);

  const won = setsWon(sets, rules);
  const draft = { ...payload(), home_score: isSets ? won.home : home, away_score: isSets ? won.away : away, forfeit: null, phase: m.phase };
  const invalid = validateResult(draft, rules);
  const tie = !isSets && home === away && m.phase === "knockout";
  const showShootout = tie && rules.knockoutTiebreak !== "extra_time" && rules.knockoutTiebreak !== "none";

  // ------------------------------------------------------------------ Match programmé
  if (m.status === "scheduled") {
    return (
      <main className="rise mx-auto max-w-xl space-y-4 px-4 pt-6 pb-16">
        <Teams homeName={homeName} awayName={awayName} />
        {!teamsKnown && <p className="rounded-xl bg-surface-2 px-4 py-3 text-center text-sm text-ink-2">Les équipes seront connues à l&apos;issue des matchs précédents.</p>}
        <button className="btn-accent h-16 w-full rounded-2xl text-lg font-semibold" disabled={!teamsKnown || pending} onClick={() => run(() => startMatchAction(m.id), () => setEditing(true))}>
          <IconPlay className="size-5" /> Démarrer le match
        </button>
        {teamsKnown && <ForfeitPanel open={showForfeit} setOpen={setShowForfeit} homeName={homeName} awayName={awayName} onForfeit={(s) => run(() => forfeitAction(m.id, s))} pending={pending} />}
        <ErrorText>{error}</ErrorText>
      </main>
    );
  }

  // ------------------------------------------------------------------ Match terminé (lecture)
  if (m.status === "finished" && !editing) {
    const o = outcome(m, rules);
    const detail = scoreText(m, rules).replace(/^\d+ - \d+ ?/, "");
    return (
      <main className="rise mx-auto max-w-xl space-y-4 px-4 pt-6 pb-16">
        <div className="card px-5 py-8 text-center">
          <div className="eyebrow">{m.forfeit ? "Forfait" : "Résultat final"}</div>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <TeamName name={homeName} win={o === "home"} dim={o === "away"} />
            <div className="text-6xl font-semibold tracking-tighter tabular-nums">
              {m.home_score}
              <span className="px-2 text-ink-3">–</span>
              {m.away_score}
            </div>
            <TeamName name={awayName} win={o === "away"} dim={o === "home"} />
          </div>
          {detail && <div className="mt-4 text-sm text-ink-2">{detail}</div>}
        </div>
        <button className="btn-outline h-12 w-full" onClick={() => setEditing(true)}>
          <IconPencil className="size-4" /> Corriger le score
        </button>
        {!m.forfeit && <ForfeitPanel open={showForfeit} setOpen={setShowForfeit} homeName={homeName} awayName={awayName} onForfeit={(s) => run(() => forfeitAction(m.id, s))} pending={pending} />}
        {isOrganizer && (
          <button
            className="btn-quiet w-full text-sm text-danger hover:text-danger"
            disabled={pending}
            onClick={() => confirm("Effacer le résultat et remettre le match à « Programmé » ?") && run(() => resetMatchAction(m.id))}
          >
            Remettre à « Programmé »
          </button>
        )}
        <ErrorText>{error}</ErrorText>
        <p className="text-center text-xs text-ink-3">Toute correction recalcule le classement et le tableau.</p>
      </main>
    );
  }

  // ------------------------------------------------------------------ Saisie (en cours ou correction)
  const cur = sets[active] ?? { home: 0, away: 0 };
  const setDone = isSets ? setWinner(cur, active, rules) : null;
  const matchDecided = isSets && Math.max(won.home, won.away) >= (rules.sets?.setsToWin ?? 99);
  const canAddSet = !!setDone && !matchDecided && active === sets.length - 1;
  const canDropSet = sets.length > 1 && active === sets.length - 1;

  const bump = (side: Side, delta: number) => {
    if (isSets) {
      setSets((prev) => prev.map((s, i) => (i === active ? { ...s, [side]: Math.max(0, s[side] + delta) } : s)));
    } else if (side === "home") setHome((x) => Math.max(0, x + delta));
    else setAway((x) => Math.max(0, x + delta));
  };

  return (
    <main className="mx-auto max-w-xl space-y-3 px-3 pt-4 pb-16">
      <div className="flex h-8 items-center justify-between px-1">
        {m.status === "live" ? (
          <>
            <LiveBadge />
            <span className="text-xs text-ink-3">{pending ? "Enregistrement…" : "Enregistré en direct"}</span>
          </>
        ) : (
          <span className="chip bg-warn-soft text-warn">
            <IconPencil className="size-3" /> Mode correction
          </span>
        )}
      </div>

      {isSets && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {sets.map((s, i) => {
            const w = setWinner(s, i, rules);
            const on = i === active;
            return (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`min-w-[76px] shrink-0 rounded-xl border px-3 py-2 text-center transition ${on ? "border-ink bg-ink text-canvas" : "border-line bg-surface"}`}
              >
                <div className={`text-[10px] font-medium tracking-wide uppercase ${on ? "opacity-60" : "text-ink-3"}`}>
                  {rules.labels.set} {i + 1}
                </div>
                <div className="flex items-center justify-center gap-1 font-semibold tabular-nums">
                  {s.home}-{s.away}
                  {w && <IconCheck className="size-3.5" />}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {(["home", "away"] as Side[]).map((side) => {
          const value = isSets ? cur[side] : side === "home" ? home : away;
          return (
            <div key={side} className="card flex flex-col items-center gap-4 p-3 pt-5">
              <div className="line-clamp-2 flex min-h-[2.5rem] items-center text-center leading-tight font-semibold">{side === "home" ? homeName : awayName}</div>
              {isSets && (
                <div className="-mt-2 text-xs text-ink-3">
                  {rules.labels.set}s gagnés : <span className="font-semibold text-ink">{won[side]}</span>
                </div>
              )}
              <div className="text-[5.5rem] leading-none font-semibold tracking-tighter tabular-nums">{value}</div>
              <div className="grid w-full gap-2">
                {rules.increments.map((inc) => (
                  <button key={inc} className="btn-primary h-16 gap-1 rounded-2xl text-2xl font-semibold" onClick={() => bump(side, inc)}>
                    <IconPlus className="size-5" />
                    {inc}
                  </button>
                ))}
                <button className="btn-ghost h-12 rounded-2xl text-lg" onClick={() => bump(side, -1)} aria-label="Retirer 1">
                  −1
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {isSets && (
        <div className="card space-y-3 p-4 text-center text-sm">
          {setDone ? (
            <div className="flex items-center justify-center gap-2 font-medium">
              <span className="grid size-5 place-items-center rounded-full bg-accent text-on-accent">
                <IconCheck className="size-3" />
              </span>
              {rules.labels.set} {active + 1} gagné par {setDone === "home" ? homeName : awayName}
            </div>
          ) : (
            <div className="text-ink-2">
              {rules.labels.set} {active + 1} en {setTarget(active, rules)} {rules.labels.scorePlural}, {rules.sets?.winBy} d&apos;écart
              {rules.sets?.cap ? ` (max ${rules.sets.cap})` : ""}
            </div>
          )}
          {(canAddSet || canDropSet) && (
            <div className="flex gap-2">
              {canAddSet && (
                <button
                  className="btn-primary flex-1"
                  onClick={() => {
                    setSets((s) => [...s, { home: 0, away: 0 }]);
                    setActive(sets.length);
                  }}
                >
                  {rules.labels.set} suivant
                </button>
              )}
              {canDropSet && (
                <button
                  className="btn-quiet"
                  onClick={() => {
                    setSets((s) => s.slice(0, -1));
                    setActive(sets.length - 2);
                  }}
                >
                  Supprimer ce {rules.labels.set}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {tie && rules.knockoutTiebreak === "extra_time" && (
        <p className="rounded-xl bg-warn-soft px-4 py-3 text-center text-sm text-warn">Égalité : jouez la prolongation et continuez la saisie.</p>
      )}
      {showShootout && (
        <div className="card space-y-3 p-4">
          <div className="eyebrow text-center">{rules.labels.tiebreak}</div>
          <div className="grid grid-cols-2 gap-3">
            {(["home", "away"] as Side[]).map((side) => (
              <div key={side} className="flex items-center justify-center gap-3">
                <button className="btn-ghost size-12 p-0 text-xl" onClick={() => setShootout((s) => ({ ...s, [side]: Math.max(0, s[side] - 1) }))} aria-label="Moins">
                  −
                </button>
                <span className="w-10 text-center text-4xl font-semibold tabular-nums">{shootout[side]}</span>
                <button className="btn-primary size-12 p-0" onClick={() => setShootout((s) => ({ ...s, [side]: s[side] + 1 }))} aria-label="Plus">
                  <IconPlus className="size-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2 pt-2">
        <button
          className={`${m.status === "finished" ? "btn-primary" : "btn-accent"} h-16 w-full rounded-2xl text-lg font-semibold`}
          disabled={pending || !!invalid}
          onClick={() =>
            confirm(m.status === "finished" ? "Enregistrer la correction ?" : "Valider le score final et terminer le match ?") &&
            run(() => finishMatchAction(m.id, payload()), () => setEditing(false))
          }
        >
          {m.status === "finished" ? (
            "Enregistrer la correction"
          ) : (
            <>
              <IconFlag className="size-5" /> Terminer le match
            </>
          )}
        </button>
        {invalid && <p className="text-center text-xs text-ink-3">{invalid}</p>}
        {m.status === "finished" && (
          <button className="btn-quiet w-full" onClick={() => router.push(back)}>
            Annuler
          </button>
        )}
      </div>
      {m.status === "live" && (
        <ForfeitPanel open={showForfeit} setOpen={setShowForfeit} homeName={homeName} awayName={awayName} onForfeit={(s) => run(() => forfeitAction(m.id, s))} pending={pending} />
      )}
      <ErrorText>{error}</ErrorText>
    </main>
  );
}

function TeamName({ name, win, dim }: { name: string; win: boolean; dim: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-2 text-base leading-tight ${win ? "font-semibold" : ""} ${dim ? "text-ink-2" : ""}`}>
      <span className={`size-2 rounded-full ${win ? "bg-accent ring-1 ring-ink/20" : "bg-transparent"}`} />
      {name}
    </div>
  );
}

function Teams({ homeName, awayName }: { homeName: string; awayName: string }) {
  return (
    <div className="card grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-10 text-center">
      <div className="text-xl leading-tight font-semibold tracking-tight">{homeName}</div>
      <div className="grid size-10 place-items-center rounded-full bg-surface-2 text-xs font-medium text-ink-3">vs</div>
      <div className="text-xl leading-tight font-semibold tracking-tight">{awayName}</div>
    </div>
  );
}

function ForfeitPanel({
  open,
  setOpen,
  homeName,
  awayName,
  onForfeit,
  pending,
}: {
  open: boolean;
  setOpen: (b: boolean) => void;
  homeName: string;
  awayName: string;
  onForfeit: (s: Side | "both") => void;
  pending: boolean;
}) {
  if (!open)
    return (
      <button className="btn-quiet w-full text-sm text-ink-3" onClick={() => setOpen(true)}>
        Déclarer un forfait…
      </button>
    );
  const ask = (s: Side | "both", label: string) => confirm(`Confirmer : ${label} ?`) && onForfeit(s);
  const btn = "btn h-12 w-full rounded-xl bg-danger-soft text-danger hover:opacity-80";
  return (
    <div className="card rise space-y-2 p-4">
      <div className="pb-1 text-center text-sm font-medium">Quelle équipe déclare forfait ?</div>
      <div className="grid grid-cols-2 gap-2">
        <button className={btn} disabled={pending} onClick={() => ask("home", `forfait de ${homeName}`)}>
          <span className="truncate">{homeName}</span>
        </button>
        <button className={btn} disabled={pending} onClick={() => ask("away", `forfait de ${awayName}`)}>
          <span className="truncate">{awayName}</span>
        </button>
      </div>
      <button className="btn-ghost w-full text-sm" disabled={pending} onClick={() => ask("both", "double forfait")}>
        Double forfait
      </button>
      <button className="btn-quiet w-full text-sm" onClick={() => setOpen(false)}>
        Annuler
      </button>
    </div>
  );
}
