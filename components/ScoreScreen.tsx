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
import { toast, useConfirm } from "./feedback";
import { LiveBadge } from "./MatchRow";
import { Led } from "./Stadium";
import { ErrorText } from "./ui";

type Haptic = "tick" | "success" | "error";
/** Retour haptique (et son, s'il est activé) : le module n'est chargé qu'au premier appui. */
const haptic = (kind: Haptic) => import("@/lib/client/fx").then(({ fx }) => fx[kind]());

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
  const [dialog, ask] = useConfirm();
  const [editing, setEditing] = useState(m.status === "live");
  const [home, setHome] = useState(m.home_score ?? 0);
  const [away, setAway] = useState(m.away_score ?? 0);
  const [sets, setSets] = useState<SetScore[]>(m.sets?.length ? m.sets : [{ home: 0, away: 0 }]);
  const [active, setActive] = useState(Math.max(0, (m.sets?.length ?? 1) - 1));
  const [shootout, setShootout] = useState<SetScore>(m.shootout ?? { home: 0, away: 0 });
  const [showForfeit, setShowForfeit] = useState(false);
  const [sync, setSync] = useState<"ok" | "saving" | "offline">("ok");
  const isSets = rules.scoreType === "sets";
  const teamsKnown = !!m.home_team_id && !!m.away_team_id;

  const payload = (): ScorePayload => ({
    home_score: home,
    away_score: away,
    sets: isSets ? sets : null,
    shootout: m.phase === "knockout" && home === away && !isSets ? shootout : null,
  });

  const run = (fn: () => Promise<ActionResult>, after?: () => void, success?: string, feel?: Haptic) =>
    start(async () => {
      let r: ActionResult;
      try {
        r = await fn();
      } catch {
        // Réseau coupé : l'action n'a pas abouti, l'utilisateur peut réessayer sans rien perdre.
        r = { ok: false, error: "Connexion impossible : vérifiez le réseau puis réessayez." };
      }
      if (!r.ok) {
        setError(r.error);
        haptic("error");
      } else {
        setError(null);
        if (feel) haptic(feel);
        if (success) toast(success);
        after?.();
        router.refresh();
      }
    });

  const forfeit = async (side: Side | "both") => {
    const who = side === "home" ? homeName : side === "away" ? awayName : null;
    const ok = await ask({
      title: who ? `Forfait de ${who} ?` : "Double forfait ?",
      body: who
        ? `${who} perd le match sur le score par défaut du sport. Le match est terminé et les classements sont recalculés.`
        : "Les deux équipes perdent le match. Le match est terminé et les classements sont recalculés.",
      confirmLabel: "Déclarer le forfait",
      tone: "danger",
    });
    if (ok) run(() => forfeitAction(m.id, side), () => setShowForfeit(false), "Forfait enregistré.", "error");
  };

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
    // Envoi différé de 500 ms ; en cas de coupure réseau, nouvel essai toutes les 3 s
    // jusqu'à ce que le score parte ou soit remplacé par une saisie plus récente.
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const send = async () => {
      setSync("saving");
      try {
        const r = await liveScoreAction(m.id, JSON.parse(payloadKey));
        if (cancelled) return;
        setSync("ok");
        setError(r.ok ? null : r.error);
      } catch {
        if (cancelled) return;
        setSync("offline");
        timer = setTimeout(send, 3000);
      }
    };
    timer = setTimeout(send, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [payloadKey, live, m.id]);

  // Prévient avant de quitter la page si le dernier score n'est pas encore enregistré.
  useEffect(() => {
    if (sync === "ok") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [sync]);

  const won = setsWon(sets, rules);
  const draft = { ...payload(), home_score: isSets ? won.home : home, away_score: isSets ? won.away : away, forfeit: null, phase: m.phase };
  const invalid = validateResult(draft, rules);
  const tie = !isSets && home === away && m.phase === "knockout";
  const showShootout = tie && rules.knockoutTiebreak !== "extra_time" && rules.knockoutTiebreak !== "none";
  const scoreLine = () =>
    isSets
      ? `${won.home}-${won.away} (${sets.map((x) => `${x.home}-${x.away}`).join(", ")})`
      : `${home}-${away}${showShootout ? ` (${rules.labels.tiebreak} ${shootout.home}-${shootout.away})` : ""}`;

  // ------------------------------------------------------------------ Match programmé
  if (m.status === "scheduled") {
    return (
      <main className="rise mx-auto max-w-xl space-y-4 px-4 pt-6 pb-16">
        <Teams homeName={homeName} awayName={awayName} />
        {!teamsKnown && <p className="rounded-md bg-surface-2 px-4 py-3 text-center text-sm text-ink-2">Les équipes seront connues à l&apos;issue des matchs précédents.</p>}
        <button className="btn-accent h-16 w-full rounded-md text-xl" disabled={!teamsKnown || pending} onClick={() => run(() => startMatchAction(m.id), () => setEditing(true))}>
          <IconPlay className="size-5" /> Démarrer le match
        </button>
        {teamsKnown && <ForfeitPanel open={showForfeit} setOpen={setShowForfeit} homeName={homeName} awayName={awayName} onForfeit={forfeit} pending={pending} />}
        <ErrorText>{error}</ErrorText>
        {dialog}
      </main>
    );
  }

  // ------------------------------------------------------------------ Match terminé (lecture)
  if (m.status === "finished" && !editing) {
    const o = outcome(m, rules);
    const detail = scoreText(m, rules).replace(/^\d+ - \d+ ?/, "");
    return (
      <main className="rise mx-auto max-w-xl space-y-4 px-4 pt-6 pb-16">
        <div className="board rounded-[10px] px-5 py-7 text-center">
          <div className="font-cond text-[12px] font-extrabold tracking-[0.2em] text-[#b4afa3] uppercase">{m.forfeit ? "Forfait" : "Fin du match"}</div>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <TeamName name={homeName} win={o === "home"} dim={o === "away"} />
            <div className="flex items-center gap-2">
              <Led value={m.home_score} digits={2} className="text-[64px]" />
              <span className="led text-[40px] opacity-60">:</span>
              <Led value={m.away_score} digits={2} className="text-[64px]" />
            </div>
            <TeamName name={awayName} win={o === "away"} dim={o === "home"} />
          </div>
          {detail && <div className="mt-4 text-sm text-[#b4afa3]">{detail}</div>}
        </div>
        <button className="btn-outline h-12 w-full" onClick={() => setEditing(true)}>
          <IconPencil className="size-4" /> Corriger le score
        </button>
        {!m.forfeit && <ForfeitPanel open={showForfeit} setOpen={setShowForfeit} homeName={homeName} awayName={awayName} onForfeit={forfeit} pending={pending} />}
        {isOrganizer && (
          <button
            className="btn-quiet w-full text-sm text-danger hover:text-danger"
            disabled={pending}
            onClick={async () =>
              (await ask({
                title: "Remettre le match à « Programmé » ?",
                body: "Le score est effacé et la suite du tableau qui en dépend est recalculée.",
                confirmLabel: "Effacer le résultat",
                tone: "danger",
              })) && run(() => resetMatchAction(m.id), undefined, "Résultat effacé.")
            }
          >
            Remettre à « Programmé »
          </button>
        )}
        <ErrorText>{error}</ErrorText>
        {dialog}
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
    // Un point marqué se sent ; un set qui se gagne sur ce point, davantage.
    if (delta > 0) haptic(isSets && !setDone && setWinner({ ...cur, [side]: cur[side] + delta }, active, rules) ? "success" : "tick");
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
            {sync === "offline" ? (
              <span className="text-xs font-medium text-danger">Hors ligne · nouvel essai…</span>
            ) : (
              <span className="text-xs text-ink-3">{pending || sync === "saving" ? "Enregistrement…" : "Enregistré en direct"}</span>
            )}
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
                className={`min-w-[76px] shrink-0 rounded-md border px-3 py-2 text-center transition ${on ? "board border-transparent ring-2 ring-accent" : "border-line bg-surface"}`}
              >
                <div className={`font-cond text-[11px] font-bold tracking-[0.1em] uppercase ${on ? "text-[#b4afa3]" : "text-ink-3"}`}>
                  {rules.labels.set} {i + 1}
                </div>
                <div className={`flex items-center justify-center gap-1 tabular-nums ${on ? "led text-lg" : "font-cond text-lg font-extrabold"}`}>
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
            <div key={side} className="card flex flex-col items-center gap-3 overflow-hidden p-3 pt-0">
              <div className={`-mx-3 h-1.5 self-stretch ${side === "home" ? "bg-accent" : "bg-ink-3"}`} aria-hidden />
              <div className="eyebrow -mb-2">{side === "home" ? "Domicile" : "Visiteur"}</div>
              <div className="display line-clamp-2 flex min-h-[3rem] items-center text-center text-[24px] leading-[0.95]">{side === "home" ? homeName : awayName}</div>
              {isSets && (
                <div className="-mt-1 font-cond text-[13px] font-bold tracking-[0.06em] text-ink-3 uppercase">
                  {rules.labels.set}s gagnés : <span className="text-ink">{won[side]}</span>
                </div>
              )}
              <div className="board w-full rounded-md py-3 text-center">
                <Led value={value} digits={2} className="text-[5.5rem]" />
              </div>
              <div className="grid w-full gap-2">
                {rules.increments.map((inc) => (
                  <button key={inc} className="btn-primary h-16 gap-1 rounded-md text-[28px]" onClick={() => bump(side, inc)}>
                    <IconPlus className="size-5" />
                    {inc}
                  </button>
                ))}
                <button className="btn-ghost h-12 rounded-md text-xl" onClick={() => bump(side, -1)} aria-label="Retirer 1">
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
              <span className="grid size-5 place-items-center rounded-full bg-ok text-on-ok">
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
        <p className="rounded-md border border-warn/40 bg-warn-soft px-4 py-3 text-center text-sm font-medium text-warn">Égalité : jouez la prolongation et continuez la saisie.</p>
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
                <span className="board w-14 rounded-md py-1 text-center"><Led value={shootout[side]} digits={1} className="text-4xl" /></span>
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
          className={`${m.status === "finished" ? "btn-primary" : "btn-accent"} h-16 w-full rounded-md text-xl`}
          disabled={pending || !!invalid}
          onClick={async () =>
            (await ask(
              m.status === "finished"
                ? { title: "Enregistrer la correction ?", body: `Nouveau score : ${homeName} ${scoreLine()} ${awayName}. Les classements seront recalculés.`, confirmLabel: "Enregistrer" }
                : { title: "Terminer le match ?", body: `Score final : ${homeName} ${scoreLine()} ${awayName}.`, confirmLabel: "Terminer le match" },
            )) && run(() => finishMatchAction(m.id, payload()), () => setEditing(false), m.status === "finished" ? "Correction enregistrée." : "Match terminé, résultat enregistré.", "success")
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
        <ForfeitPanel open={showForfeit} setOpen={setShowForfeit} homeName={homeName} awayName={awayName} onForfeit={forfeit} pending={pending} />
      )}
      <ErrorText>{error}</ErrorText>
        {dialog}
    </main>
  );
}

function TeamName({ name, win, dim }: { name: string; win: boolean; dim: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-2 font-cond text-[17px] leading-tight font-bold uppercase ${dim ? "text-[#858074]" : "text-[#f3efe4]"}`}>
      <span className={`h-1 w-6 rounded-full ${win ? "bg-[#3ddc84]" : "bg-transparent"}`} />
      {name}
    </div>
  );
}

function Teams({ homeName, awayName }: { homeName: string; awayName: string }) {
  return (
    <div className="board grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-[10px] px-5 py-10 text-center">
      <div className="display text-[30px] leading-[0.95] text-[#f3efe4]">{homeName}</div>
      <div className="led text-[34px]">VS</div>
      <div className="display text-[30px] leading-[0.95] text-[#f3efe4]">{awayName}</div>
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
  const btn = "btn h-12 w-full rounded-md border border-danger/30 bg-danger-soft text-danger hover:opacity-80";
  return (
    <div className="card rise space-y-2 overflow-hidden p-4 pt-0">
      <div className="hazard -mx-4 mb-3 h-1.5" aria-hidden />
      <div className="display pb-1 text-center text-[22px]">Quelle équipe déclare forfait ?</div>
      <div className="grid grid-cols-2 gap-2">
        <button className={btn} disabled={pending} onClick={() => onForfeit("home")}>
          <span className="truncate">{homeName}</span>
        </button>
        <button className={btn} disabled={pending} onClick={() => onForfeit("away")}>
          <span className="truncate">{awayName}</span>
        </button>
      </div>
      <button className="btn-ghost w-full text-sm" disabled={pending} onClick={() => onForfeit("both")}>
        Double forfait
      </button>
      <button className="btn-quiet w-full text-sm" onClick={() => setOpen(false)}>
        Annuler
      </button>
    </div>
  );
}
