"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/app/actions";
import { CRITERIA_LABELS, TIEBREAK_LABELS } from "@/lib/sports";
import type { KnockoutTiebreak, ScoreType, SportRules, TiebreakCriterion } from "@/lib/types";
import { IconCheck, IconDown, IconUp, IconX } from "./Icons";
import { Choice, Field, Switch } from "./ui";

const ALL_CRITERIA = Object.keys(CRITERIA_LABELS) as TiebreakCriterion[];

export function RulesEditor({
  initial,
  onSave,
  name,
  saveLabel = "Enregistrer les règles",
  warning,
}: {
  initial: SportRules;
  onSave: (rules: SportRules, name?: string) => Promise<ActionResult>;
  name?: string;
  saveLabel?: string;
  warning?: string;
}) {
  const router = useRouter();
  const [r, setR] = useState<SportRules>(initial);
  const [sportName, setSportName] = useState(name ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof SportRules>(k: K, v: SportRules[K]) => {
    setMsg(null);
    setR((x) => ({ ...x, [k]: v }));
  };
  const num = (v: string) => (v === "" ? 0 : Number(v));

  const save = () =>
    start(async () => {
      const res = await onSave(r, name !== undefined ? sportName : undefined);
      setMsg(res.ok ? { ok: true, text: "Enregistré" } : { ok: false, text: res.error });
      router.refresh();
    });

  const move = (i: number, d: number) => {
    const list = [...r.tiebreakers];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    set("tiebreakers", list);
  };

  const setScoreType = (st: ScoreType) =>
    setR((x) => ({
      ...x,
      scoreType: st,
      sets: st === "sets" ? (x.sets ?? { setsToWin: 2, pointsPerSet: 25, lastSetPoints: 15, winBy: 2, cap: null }) : x.sets,
      allowDraw: st === "sets" ? false : x.allowDraw,
      knockoutTiebreak: st === "sets" ? "none" : x.knockoutTiebreak === "none" ? "penalties" : x.knockoutTiebreak,
    }));

  const unused = ALL_CRITERIA.filter((c) => !r.tiebreakers.includes(c));
  const dirty = JSON.stringify(r) !== JSON.stringify(initial) || (name !== undefined && sportName !== name);

  return (
    <div className="space-y-4">
      {name !== undefined && (
        <Group title="Sport">
          <Field label="Nom du sport">
            <input className="input" value={sportName} onChange={(e) => setSportName(e.target.value)} placeholder="Ex. Ultimate" />
          </Field>
        </Group>
      )}

      <Group title="Score">
        <Field label="Type de score">
          <Choice
            full
            options={[
              { value: "goals", label: "Buts" },
              { value: "points", label: "Points" },
              { value: "sets", label: "Sets" },
            ]}
            value={r.scoreType}
            onChange={setScoreType}
          />
        </Field>
        <Field label="Boutons « + » de la saisie" hint="Valeurs séparées par des virgules, ex. 1, 2, 3">
          <input
            className="input"
            defaultValue={r.increments.join(", ")}
            onBlur={(e) => {
              const list = e.target.value
                .split(/[,; ]+/)
                .map(Number)
                .filter((n) => n > 0);
              set("increments", list.length ? list : [1]);
            }}
          />
        </Field>
        {r.scoreType !== "sets" && <Switch label="Match nul autorisé en poule" checked={r.allowDraw} onChange={(v) => set("allowDraw", v)} />}
        {r.scoreType === "sets" && r.sets && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Field label="Sets gagnants">
              <input type="number" min={1} max={4} className="input" value={r.sets.setsToWin} onChange={(e) => set("sets", { ...r.sets!, setsToWin: Math.max(1, num(e.target.value)) })} />
            </Field>
            <Field label="Points / set">
              <input type="number" min={1} className="input" value={r.sets.pointsPerSet} onChange={(e) => set("sets", { ...r.sets!, pointsPerSet: num(e.target.value) })} />
            </Field>
            <Field label="Set décisif">
              <input type="number" min={1} className="input" value={r.sets.lastSetPoints} onChange={(e) => set("sets", { ...r.sets!, lastSetPoints: num(e.target.value) })} />
            </Field>
            <Field label="Écart mini">
              <input type="number" min={1} className="input" value={r.sets.winBy} onChange={(e) => set("sets", { ...r.sets!, winBy: Math.max(1, num(e.target.value)) })} />
            </Field>
            <Field label="Plafond">
              <input
                type="number"
                min={0}
                placeholder="aucun"
                className="input"
                value={r.sets.cap ?? ""}
                onChange={(e) => set("sets", { ...r.sets!, cap: e.target.value === "" ? null : num(e.target.value) })}
              />
            </Field>
          </div>
        )}
      </Group>

      <Group title="Points au classement">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Victoire">
            <input type="number" className="input" value={r.points.win} onChange={(e) => set("points", { ...r.points, win: num(e.target.value) })} />
          </Field>
          {r.allowDraw && (
            <Field label="Nul">
              <input type="number" className="input" value={r.points.draw} onChange={(e) => set("points", { ...r.points, draw: num(e.target.value) })} />
            </Field>
          )}
          <Field label="Défaite">
            <input type="number" className="input" value={r.points.loss} onChange={(e) => set("points", { ...r.points, loss: num(e.target.value) })} />
          </Field>
          <Field label="Forfait">
            <input type="number" className="input" value={r.points.forfeit} onChange={(e) => set("points", { ...r.points, forfeit: num(e.target.value) })} />
          </Field>
        </div>
        {r.scoreType === "sets" && (
          <>
            <Switch
              label="Barème au set décisif"
              hint="Volley : 3-2 → 2 pts au vainqueur, 1 pt au perdant"
              checked={r.points.closeWin !== undefined}
              onChange={(v) =>
                set("points", v ? { ...r.points, closeWin: 2, closeLoss: 1 } : { win: r.points.win, draw: r.points.draw, loss: r.points.loss, forfeit: r.points.forfeit })
              }
            />
            {r.points.closeWin !== undefined && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Victoire serrée">
                  <input type="number" className="input" value={r.points.closeWin} onChange={(e) => set("points", { ...r.points, closeWin: num(e.target.value) })} />
                </Field>
                <Field label="Défaite serrée">
                  <input type="number" className="input" value={r.points.closeLoss} onChange={(e) => set("points", { ...r.points, closeLoss: num(e.target.value) })} />
                </Field>
              </div>
            )}
          </>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label={r.scoreType === "sets" ? "Forfait : pts/set vainqueur" : "Forfait : score vainqueur"}>
            <input type="number" className="input" value={r.forfeitScore.winner} onChange={(e) => set("forfeitScore", { ...r.forfeitScore, winner: num(e.target.value) })} />
          </Field>
          <Field label="Forfait : score perdant">
            <input type="number" className="input" value={r.forfeitScore.loser} onChange={(e) => set("forfeitScore", { ...r.forfeitScore, loser: num(e.target.value) })} />
          </Field>
        </div>
      </Group>

      <Group title="Critères de départage" hint="Appliqués dans l'ordre. En dernier recours : tirage au sort.">
        <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {r.tiebreakers.map((c, i) => (
            <li key={c} className="flex items-center gap-2 py-1.5 pr-1.5 pl-4 text-sm">
              <span className="w-5 font-medium text-ink-3 tabular-nums">{i + 1}</span>
              <span className="flex-1">{CRITERIA_LABELS[c]}</span>
              <button className="btn-icon size-8" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Monter">
                <IconUp className="size-4" />
              </button>
              <button className="btn-icon size-8" onClick={() => move(i, 1)} disabled={i === r.tiebreakers.length - 1} aria-label="Descendre">
                <IconDown className="size-4" />
              </button>
              <button className="btn-icon size-8 hover:bg-danger-soft hover:text-danger" onClick={() => set("tiebreakers", r.tiebreakers.filter((x) => x !== c))} aria-label="Retirer">
                <IconX className="size-4" />
              </button>
            </li>
          ))}
        </ol>
        {unused.length > 0 && (
          <select className="input text-ink-2" value="" onChange={(e) => e.target.value && set("tiebreakers", [...r.tiebreakers, e.target.value as TiebreakCriterion])}>
            <option value="">+ Ajouter un critère…</option>
            {unused.map((c) => (
              <option key={c} value={c}>
                {CRITERIA_LABELS[c]}
              </option>
            ))}
          </select>
        )}
      </Group>

      <Group title="Phase finale">
        <Field label="Départage en cas d'égalité">
          <select className="input" value={r.knockoutTiebreak} onChange={(e) => set("knockoutTiebreak", e.target.value as KnockoutTiebreak)}>
            {(Object.keys(TIEBREAK_LABELS) as KnockoutTiebreak[]).map((k) => (
              <option key={k} value={k}>
                {TIEBREAK_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
      </Group>

      <Group title="Vocabulaire" hint="Mots affichés dans l'application pour ce sport.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(
            [
              ["score", "Unité de score"],
              ["scorePlural", "… au pluriel"],
              ["court", "Lieu de jeu"],
              ["courtPlural", "… au pluriel"],
              ["set", "Set / manche"],
              ["tiebreak", "Départage"],
            ] as [keyof SportRules["labels"], string][]
          ).map(([k, l]) => (
            <Field key={k} label={l}>
              <input className="input" value={r.labels[k]} onChange={(e) => set("labels", { ...r.labels, [k]: e.target.value })} />
            </Field>
          ))}
        </div>
      </Group>

      <Group title="Durées par défaut">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Match (min)">
            <input type="number" className="input" value={r.defaults.matchDuration} onChange={(e) => set("defaults", { ...r.defaults, matchDuration: num(e.target.value) })} />
          </Field>
          <Field label="Pause (min)">
            <input type="number" className="input" value={r.defaults.breakDuration} onChange={(e) => set("defaults", { ...r.defaults, breakDuration: num(e.target.value) })} />
          </Field>
        </div>
      </Group>

      {warning && <p className="px-1 text-xs leading-relaxed text-ink-3">{warning}</p>}
      <div className="sticky bottom-4 z-10 flex items-center gap-3 rounded-full border border-line bg-surface/90 p-1.5 pl-5 shadow-[0_8px_30px_rgb(0_0_0/0.08)] backdrop-blur-xl">
        <span className={`flex-1 truncate text-sm ${msg ? (msg.ok ? "text-ink" : "text-danger") : "text-ink-3"}`}>
          {msg ? (
            <span className="inline-flex items-center gap-1.5">
              {msg.ok && <IconCheck className="size-4" />}
              {msg.text}
            </span>
          ) : dirty ? (
            "Modifications non enregistrées"
          ) : (
            "Aucune modification"
          )}
        </span>
        <button className="btn-primary" disabled={pending} onClick={save}>
          {pending ? "Enregistrement…" : saveLabel}
        </button>
      </div>
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4 p-5">
      <div>
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        {hint && <p className="mt-0.5 text-[13px] text-ink-3">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
