"use client";

import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createTournamentAction } from "@/app/actions";
import { validateInput, type TournamentInput } from "@/lib/build";
import { distributeRandom, distributeSeeded, poolName, poolSizes, POOL_MAX, POOL_MIN, shuffle, suggestPoolCount, validPoolCounts } from "@/lib/pools";
import type { Format, Sport } from "@/lib/types";
import { fmtDuration, FORMAT_LABEL } from "@/lib/view";
import {
  defaultQualifierOption,
  fitMatchDuration,
  MAX_TEAMS,
  MIN_TEAMS,
  parseTeams,
  placeholderTeams,
  previewEnd,
  qualifierOptions,
  recommendFormat,
  type QualifierOption,
} from "@/lib/wizard";
import { IconArrowLeft, IconArrowRight, IconCheck, IconClock, IconDice, IconDown, IconPlus, IconSparkle, IconUp, IconX } from "./Icons";
import { toast, useConfirm } from "./feedback";
import { Choice, ErrorText, Field, Stepper, Switch } from "./ui";

const STEPS = ["Tournoi", "Équipes", "Format", "Horaires"];
const STEP_TITLES = ["Le tournoi", "Les équipes", "Le format", "Horaires et terrains"];
const STEP_HINTS = [
  "Le sport, le jour et l'heure du premier match. Tout reste modifiable.",
  "Tapez ou collez vos équipes. Pas encore les noms ? Créez des équipes provisoires, vous les renommerez plus tard.",
  "Comparez les formules : le nombre de matchs et l'heure de fin se calculent en direct.",
  "Réglez le rythme et vérifiez l'heure de fin, puis créez le tournoi.",
];
const FORMAT_HINT: Record<Format, string> = {
  pools: "Chacun rencontre toutes les équipes de sa poule. Un classement par poule.",
  pools_knockout: "Des poules, puis un tableau final avec les meilleurs. Le plus classique.",
  knockout: "Tableau direct : un match perdu et c'est fini. Le plus rapide.",
};
const FORMATS: Format[] = ["pools_knockout", "pools", "knockout"];
const DRAFT_KEY = "matchzy:nouveau-tournoi";

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const suggestName = (s?: Sport) => (!s || s.name === "Personnalisé" ? "Mon tournoi" : `Tournoi de ${s.name.toLowerCase()}`);
const hhmm = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

interface Draft {
  step: number;
  name: string;
  date: string;
  time: string;
  sportId: string;
  matchDuration: number;
  breakDuration: number;
  minRest: number;
  courts: number;
  teams: string[];
  format: Format | null;
  poolChoice: number | null;
  pools: number[][];
  distMode: "random" | "seeded" | "manual";
  qualChoice: { q: number; extra: number } | null;
  thirdPlace: boolean;
  koOrder: number[];
}

export function TournamentWizard({ sports }: { sports: Sport[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [dialog, ask] = useConfirm();
  const loaded = useRef(false);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [time, setTime] = useState("09:00");
  const [sportId, setSportId] = useState(sports[0]?.id ?? "");
  const sport = sports.find((s) => s.id === sportId) ?? sports[0];
  const [matchDuration, setMatchDuration] = useState(sport?.rules.defaults.matchDuration ?? 15);
  const [breakDuration, setBreakDuration] = useState(sport?.rules.defaults.breakDuration ?? 5);
  const [minRest, setMinRest] = useState(10);
  const [courts, setCourts] = useState(2);

  const [teams, setTeams] = useState<string[]>([]);
  const [entry, setEntry] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ text: string; restore: () => void } | null>(null);
  const [placeholderCount, setPlaceholderCount] = useState(8);

  // null = format conseillé selon le nombre d'équipes, tant que l'organisateur n'a pas choisi.
  const [formatChoice, setFormatChoice] = useState<Format | null>(null);
  const [poolChoice, setPoolChoice] = useState<number | null>(null);
  const [pools, setPools] = useState<number[][]>([]);
  const [distMode, setDistMode] = useState<"random" | "seeded" | "manual">("random");
  const [qualChoice, setQualChoice] = useState<{ q: number; extra: number } | null>(null);
  const [thirdPlace, setThirdPlace] = useState(true);
  const [koOrder, setKoOrder] = useState<number[]>([]);
  const [deadline, setDeadline] = useState("");
  const [fitMsg, setFitMsg] = useState<string | null>(null);

  // ---------------------------------------------------------------- Brouillon (survit à un rechargement)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Draft;
        if (d.teams?.length || d.name) {
          setStep(d.step ?? 0);
          setName(d.name ?? "");
          setDate(d.date && d.date >= todayLocal() ? d.date : todayLocal());
          setTime(d.time ?? "09:00");
          if (sports.some((s) => s.id === d.sportId)) setSportId(d.sportId);
          setMatchDuration(d.matchDuration);
          setBreakDuration(d.breakDuration);
          setMinRest(d.minRest);
          setCourts(d.courts);
          setTeams(d.teams ?? []);
          setFormatChoice(d.format ?? null);
          setPoolChoice(d.poolChoice ?? null);
          setPools(d.pools ?? []);
          setDistMode(d.distMode ?? "random");
          setQualChoice(d.qualChoice ?? null);
          setThirdPlace(d.thirdPlace ?? true);
          setKoOrder(d.koOrder ?? []);
          setRestored(true);
        }
      }
    } catch {}
    loaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draft: Draft = {
    step,
    name,
    date,
    time,
    sportId,
    matchDuration,
    breakDuration,
    minRest,
    courts,
    teams,
    format: formatChoice,
    poolChoice,
    pools,
    distMode,
    qualChoice,
    thirdPlace,
    koOrder,
  };
  const draftJson = JSON.stringify(draft);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(DRAFT_KEY, draftJson);
    } catch {}
  }, [draftJson]);

  const resetAll = async () => {
    const ok = await ask({
      title: "Tout recommencer ?",
      body: "Le brouillon en cours (équipes, format, horaires) sera effacé.",
      confirmLabel: "Effacer le brouillon",
      tone: "danger",
    });
    if (!ok) return;
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    window.location.reload();
  };

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(t);
  }, [undo]);

  // ---------------------------------------------------------------- Valeurs dérivées (toujours cohérentes)
  const n = teams.length;
  const L = sport?.rules.labels;
  const courtsLabel = L?.courtPlural ?? "terrains";
  const courtLabel = L?.court ?? "terrain";
  const format: Format = formatChoice ?? recommendFormat(n);
  const counts = useMemo(() => validPoolCounts(n), [n]);
  const poolCount = poolChoice && counts.includes(poolChoice) ? poolChoice : suggestPoolCount(n, 4);

  const poolsValid = useMemo(() => {
    const flat = pools.flat();
    return pools.length === poolCount && flat.length === n && new Set(flat).size === n && flat.every((i) => i >= 0 && i < n);
  }, [pools, poolCount, n]);
  useEffect(() => {
    if (poolsValid || n < 2) return;
    setPools(distMode === "seeded" ? distributeSeeded(teams.map((_, i) => i), poolCount) : distributeRandom(n, poolCount));
    if (distMode === "manual") setDistMode("random");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolsValid, n, poolCount]);

  const sizes = pools.map((p) => p.length);
  const qualOptions = useMemo(() => qualifierOptions(sizes), [sizes.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const qual: QualifierOption | null =
    qualOptions.find((o) => qualChoice && o.qualifiers === qualChoice.q && o.bestExtra === qualChoice.extra) ?? defaultQualifierOption(qualOptions);

  const order = koOrder.length === n && new Set(koOrder).size === n ? koOrder : teams.map((_, i) => i);
  const effectiveName = name.trim() || suggestName(sport);

  const makeInput = (f: Format): TournamentInput | null =>
    sport
      ? {
          name: effectiveName,
          date,
          sportId: sport.id,
          sportName: sport.name,
          rules: sport.rules,
          format: f,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          startAt: new Date(`${date}T${time || "09:00"}`).toISOString(),
          matchDuration,
          breakDuration,
          minRest,
          courts,
          teams: teams.map((t, i) => ({ name: t, seed: i + 1 })),
          pools: f === "knockout" ? [] : pools,
          qualifiersPerPool: qual?.qualifiers ?? 1,
          bestExtra: qual?.bestExtra ?? 0,
          thirdPlace,
          knockoutOrder: order,
        }
      : null;

  const input = makeInput(format);
  const invalid = input ? validateInput(input) : "Aucun sport disponible.";
  const deps = JSON.stringify([input, poolsValid]);
  const previews = useMemo(() => {
    const res = {} as Record<Format, ReturnType<typeof previewEnd>>;
    for (const f of FORMATS) {
      const i = makeInput(f);
      res[f] = i && (f === "knockout" || poolsValid) ? previewEnd(i) : null;
    }
    return res;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps]);
  const preview = previews[format];
  const startDate = new Date(`${date}T${time || "09:00"}`);

  // ---------------------------------------------------------------- Actions
  const pickSport = (id: string) => {
    setSportId(id);
    const s = sports.find((x) => x.id === id);
    if (s) {
      setMatchDuration(s.rules.defaults.matchDuration);
      setBreakDuration(s.rules.defaults.breakDuration);
    }
  };

  const addEntry = () => {
    const { added, duplicates, overflow } = parseTeams(entry, teams);
    if (added.length) setTeams([...teams, ...added]);
    setEntry("");
    const msgs = [];
    if (added.length > 1) msgs.push(`${added.length} équipes ajoutées`);
    if (duplicates.length) msgs.push(`${plural(duplicates.length, "doublon")} ignoré${duplicates.length > 1 ? "s" : ""} (${duplicates.slice(0, 3).join(", ")}${duplicates.length > 3 ? "…" : ""})`);
    if (overflow) msgs.push(`${overflow} en trop (maximum ${MAX_TEAMS})`);
    setNotice(msgs.length ? msgs.join(" · ") : null);
  };

  const removeTeams = (next: string[], text: string) => {
    const before = teams;
    setTeams(next);
    setUndo({ text, restore: () => setTeams(before) });
  };

  const blocker = [
    !sport ? "Choisissez un sport." : null,
    n < MIN_TEAMS ? `Ajoutez encore ${plural(MIN_TEAMS - n, "équipe")} (minimum ${MIN_TEAMS}).` : input && validateInput({ ...input, pools: [], format: "knockout" }),
    invalid,
    invalid,
  ][step];
  const reachable = (i: number) => i <= step || [0, 1, 2].slice(0, i).every((k) => !blockerFor(k));
  function blockerFor(k: number) {
    if (k === 0) return !sport;
    if (k === 1) return n < MIN_TEAMS || !!(input && validateInput({ ...input, pools: [], format: "knockout" }));
    return !!invalid;
  }

  const fit = () => {
    if (!input || !deadline) return;
    const target = new Date(`${date}T${deadline}`);
    if (target <= startDate) return setFitMsg("L'heure de fin doit être après le premier match.");
    const d = fitMatchDuration(input, target);
    if (d === null) {
      setFitMsg(`Impossible de finir à ${deadline}, même avec des matchs d'une minute. Ajoutez des ${courtsLabel} ou choisissez un format plus court.`);
    } else {
      setMatchDuration(d);
      setFitMsg(d === matchDuration ? `C'est déjà bon : les matchs de ${d} min finissent avant ${deadline}.` : `Matchs réglés à ${d} min pour finir avant ${deadline}.`);
    }
  };

  const submit = () =>
    start(async () => {
      if (!input) return;
      const r = await createTournamentAction(input);
      if (r.error) setError(r.error);
      else {
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {}
        toast(`« ${effectiveName} » est créé. Voici votre tableau de bord.`);
        router.push(`/t/${r.slug}/admin`);
      }
    });

  const next = () => {
    if (blocker) return;
    if (step < 3) setStep(step + 1);
    else submit();
  };

  // ---------------------------------------------------------------- Rendu
  return (
    <div className="space-y-8 pb-40">
      {dialog}
      {restored && (
        <div className="rise flex items-center justify-between gap-3 rounded-2xl bg-accent-soft px-4 py-3 text-sm">
          <span>Nous avons repris votre brouillon là où vous l&apos;aviez laissé.</span>
          <button className="shrink-0 font-medium underline underline-offset-4" onClick={resetAll}>
            Tout recommencer
          </button>
        </div>
      )}

      <div className="space-y-4">
        <nav className="grid grid-cols-4 gap-1.5" aria-label="Étapes">
          {STEPS.map((s, i) => {
            const can = i !== step && reachable(i);
            return (
              <button
                key={s}
                onClick={() => can && setStep(i)}
                disabled={!can}
                aria-current={i === step ? "step" : undefined}
                className={`group text-left ${can ? "cursor-pointer" : "cursor-default"}`}
              >
                <span className={`block h-1 rounded-full transition-colors ${i <= step ? "bg-ink" : "bg-line"} ${can ? "group-hover:opacity-70" : ""}`} />
                <span className={`mt-1.5 block truncate text-xs ${i === step ? "font-semibold text-ink" : "text-ink-3"} ${can ? "group-hover:text-ink" : ""}`}>{s}</span>
              </button>
            );
          })}
        </nav>
        <div key={step} className="rise">
          <h1 className="text-3xl font-semibold tracking-tight">{STEP_TITLES[step]}</h1>
          <p className="mt-1 text-[15px] text-ink-2">{STEP_HINTS[step]}</p>
        </div>
      </div>

      {step === 0 && (
        <div className="rise space-y-7">
          <div>
            <span className="label">Sport</span>
            <div className="flex flex-wrap gap-1.5">
              {sports.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickSport(s.id)}
                  className={`inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition ${
                    s.id === sportId ? "bg-ink text-canvas" : "border border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink"
                  }`}
                >
                  {s.id === sportId && <IconCheck className="size-3.5" />}
                  {s.name}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-3">Fixe le comptage des points et la durée conseillée des matchs. Les règles restent modifiables pour ce tournoi.</p>
          </div>
          <label className="block">
            <span className="label">Nom du tournoi</span>
            <input
              className="w-full border-b border-line bg-transparent pb-3 text-2xl font-medium tracking-tight outline-none placeholder:text-ink-3 focus:border-ink"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && next()}
              placeholder={suggestName(sport)}
            />
            {!name.trim() && <span className="mt-1.5 block text-xs text-ink-3">Facultatif : laissé vide, il s&apos;appellera « {suggestName(sport)} ».</span>}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input type="date" className="input" value={date} min={todayLocal()} onChange={(e) => setDate(e.target.value || todayLocal())} />
            </Field>
            <Field label="Premier match à">
              <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="rise space-y-5">
          <div className="card overflow-hidden focus-within:border-ink">
            <textarea
              className="block min-h-24 w-full resize-none bg-transparent px-4 pt-4 text-base outline-none placeholder:text-ink-3"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              onPaste={(e) => {
                // Un collage de plusieurs lignes est ajouté directement.
                const text = e.clipboardData.getData("text");
                if (/[\r\n]/.test(text.trim()) && !entry.trim()) {
                  e.preventDefault();
                  const { added, duplicates, overflow } = parseTeams(text, teams);
                  setTeams([...teams, ...added]);
                  setNotice(
                    [
                      `${plural(added.length, "équipe")} ajoutée${added.length > 1 ? "s" : ""}`,
                      duplicates.length ? `${plural(duplicates.length, "doublon")} ignoré${duplicates.length > 1 ? "s" : ""}` : "",
                      overflow ? `${overflow} en trop (maximum ${MAX_TEAMS})` : "",
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  );
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (entry.trim()) addEntry();
                  else if (n >= MIN_TEAMS) next();
                }
              }}
              placeholder={n ? "Équipe suivante…" : "Nom d'une équipe, puis Entrée\nou collez une liste entière (Excel, e-mail…)"}
              aria-label="Ajouter des équipes"
              autoFocus
            />
            <div className="flex items-center justify-between gap-3 px-4 pb-3">
              <span className="text-xs text-ink-3">Entrée pour ajouter{n >= MIN_TEAMS ? " · Entrée sur une ligne vide pour continuer" : ""}</span>
              <button className="btn-primary h-9 px-4 text-sm" disabled={!entry.trim() || n >= MAX_TEAMS} onClick={addEntry}>
                <IconPlus className="size-4" /> Ajouter
              </button>
            </div>
          </div>
          {notice && <p className="rise text-sm text-ink-2">{notice}</p>}

          {n === 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-line-strong p-4">
              <span className="mr-auto text-sm text-ink-2">Pas encore les noms ?</span>
              <div className="w-36">
                <Stepper value={placeholderCount} min={MIN_TEAMS} max={MAX_TEAMS} onChange={setPlaceholderCount} />
              </div>
              <button className="btn-outline h-11 text-sm" onClick={() => setTeams(placeholderTeams(placeholderCount, []))}>
                <IconSparkle className="size-4" /> Créer {placeholderCount} équipes
              </button>
            </div>
          )}

          {n > 0 && (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-sm">
                  <span className="font-semibold tabular-nums">{n}</span> équipe{n > 1 ? "s" : ""}
                  <span className="text-ink-3">{n < MIN_TEAMS ? ` · encore ${MIN_TEAMS - n} minimum` : ` · jusqu'à ${MAX_TEAMS}`}</span>
                </span>
                <button className="text-sm text-ink-3 hover:text-danger" onClick={() => removeTeams([], "Liste vidée.")}>
                  Tout effacer
                </button>
              </div>
              <ol className="card divide-y divide-line overflow-hidden">
                {teams.map((t, i) => {
                  const dup = t.trim() && teams.findIndex((x) => x.trim().toLowerCase() === t.trim().toLowerCase()) !== i;
                  const bad = !t.trim() || dup;
                  return (
                    <li key={i} className={`group flex items-center gap-2 py-1 pr-1.5 pl-4 ${bad ? "bg-danger-soft" : ""}`}>
                      <span className="w-6 text-sm font-medium text-ink-3 tabular-nums">{i + 1}</span>
                      <input
                        className="h-9 min-w-0 flex-1 bg-transparent outline-none"
                        value={t}
                        aria-label={`Équipe ${i + 1}`}
                        aria-invalid={bad || undefined}
                        onChange={(e) => setTeams(teams.map((x, k) => (k === i ? e.target.value : x)))}
                      />
                      {bad && <span className="text-xs font-medium text-danger">{dup ? "Déjà dans la liste" : "Nom vide"}</span>}
                      <button className="btn-icon size-8" disabled={i === 0} onClick={() => setTeams(swap(teams, i, i - 1))} aria-label="Monter">
                        <IconUp className="size-4" />
                      </button>
                      <button className="btn-icon size-8" disabled={i === n - 1} onClick={() => setTeams(swap(teams, i, i + 1))} aria-label="Descendre">
                        <IconDown className="size-4" />
                      </button>
                      <button
                        className="btn-icon size-8 hover:bg-danger-soft hover:text-danger"
                        onClick={() => removeTeams(
                          teams.filter((_, k) => k !== i),
                          `« ${t || "Équipe sans nom"} » retirée.`,
                        )}
                        aria-label="Supprimer"
                      >
                        <IconX className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ol>
              <p className="text-xs text-ink-3">Vous voulez des têtes de série ? Placez les équipes les plus fortes en haut de la liste. Sinon, l&apos;ordre n&apos;a pas d&apos;importance.</p>
            </>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="rise space-y-5">
          <div className="grid gap-2 sm:grid-cols-3">
            {FORMATS.map((f) => {
              const on = format === f;
              const p = previews[f];
              return (
                <button
                  key={f}
                  onClick={() => setFormatChoice(f)}
                  className={`relative flex flex-col rounded-2xl border p-4 text-left transition ${on ? "border-ink bg-surface ring-1 ring-ink" : "border-line bg-surface hover:border-line-strong"}`}
                >
                  <span className={`absolute top-4 right-4 grid size-5 place-items-center rounded-full ${on ? "bg-accent text-on-accent" : "border border-line-strong"}`}>
                    {on && <IconCheck className="size-3" />}
                  </span>
                  {f === recommendFormat(n) && <span className="chip mb-2 self-start bg-accent-soft text-ink">Conseillé pour {n} équipes</span>}
                  <div className="pr-6 font-semibold tracking-tight">{FORMAT_LABEL[f]}</div>
                  <div className="mt-1 flex-1 text-[13px] text-ink-3">{FORMAT_HINT[f]}</div>
                  <div className="mt-3 border-t border-line pt-3 text-sm">
                    {p ? (
                      <>
                        <span className="font-semibold tabular-nums">{p.matches}</span> matchs · fin vers <span className="font-semibold tabular-nums">{hhmm(p.end)}</span>
                        <span className="block text-xs text-ink-3">{fmtDuration((p.end.getTime() - startDate.getTime()) / 60000)} de jeu</span>
                      </>
                    ) : (
                      <span className="text-ink-3">–</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {format !== "knockout" && (
            <div className="card space-y-5 p-5">
              {counts.length > 1 && (
                <div>
                  <span className="label">Nombre de poules</span>
                  <div className="flex flex-wrap gap-1.5">
                    {counts.map((k) => {
                      const s = [...new Set(poolSizes(n, k))].sort().reverse();
                      const on = k === poolCount;
                      return (
                        <button
                          key={k}
                          onClick={() => setPoolChoice(k)}
                          className={`rounded-xl px-3.5 py-2 text-left transition ${on ? "bg-ink text-canvas" : "border border-line bg-surface hover:border-line-strong"}`}
                        >
                          <span className="block text-sm font-semibold">{plural(k, "poule")}</span>
                          <span className={`block text-xs ${on ? "opacity-60" : "text-ink-3"}`}>de {s.join(" ou ")} équipes</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="label mb-0">{pools.length > 1 ? "Composition des poules" : "La poule"}</span>
                  {pools.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      <Choice
                        options={[
                          { value: "random", label: "Au hasard" },
                          { value: "seeded", label: "Par niveau" },
                          ...(distMode === "manual" ? [{ value: "manual" as const, label: "À la main" }] : []),
                        ]}
                        value={distMode}
                        onChange={(mode) => {
                          if (mode === "manual") return;
                          setDistMode(mode);
                          setPools(mode === "seeded" ? distributeSeeded(teams.map((_, i) => i), poolCount) : distributeRandom(n, poolCount));
                        }}
                      />
                      <button
                        className="btn-icon"
                        title="Nouveau tirage au sort"
                        aria-label="Nouveau tirage au sort"
                        onClick={() => {
                          setDistMode("random");
                          setPools(distributeRandom(n, poolCount));
                        }}
                      >
                        <IconDice />
                      </button>
                    </div>
                  )}
                </div>
                <PoolBoard
                  pools={pools}
                  teams={teams}
                  onChange={(p) => {
                    setPools(p);
                    setDistMode("manual");
                  }}
                />
                {pools.length > 1 && (
                  <p className="mt-2 text-xs text-ink-3">
                    {distMode === "seeded"
                      ? "Les premières équipes de votre liste sont réparties dans des poules différentes. "
                      : ""}
                    Glissez une équipe vers une autre poule pour ajuster.
                  </p>
                )}
              </div>
            </div>
          )}

          {format === "pools_knockout" && (
            <div className="card space-y-4 p-5">
              <span className="label mb-0">Qui passe en phase finale ?</span>
              <div className="grid gap-1.5">
                {qualOptions.map((o) => {
                  const on = qual === o;
                  return (
                    <button
                      key={`${o.qualifiers}-${o.bestExtra}`}
                      onClick={() => setQualChoice({ q: o.qualifiers, extra: o.bestExtra })}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${on ? "border-ink ring-1 ring-ink" : "border-line hover:border-line-strong"}`}
                    >
                      <span className={`grid size-5 shrink-0 place-items-center rounded-full ${on ? "bg-accent text-on-accent" : "border border-line-strong"}`}>{on && <IconCheck className="size-3" />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{o.title}</span>
                        <span className="block text-xs text-ink-3">{o.detail}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <Switch label="Petite finale" hint="Un match pour la 3e place" checked={thirdPlace} onChange={setThirdPlace} />
            </div>
          )}

          {format === "knockout" && (
            <div className="card space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">Placement dans le tableau</span>
                <div className="flex gap-1">
                  <button className="btn-ghost h-9 px-3.5 text-sm" onClick={() => setKoOrder(teams.map((_, i) => i))}>
                    Par niveau (ordre de la liste)
                  </button>
                  <button className="btn-ghost h-9 px-3.5 text-sm" onClick={() => setKoOrder(shuffle(teams.map((_, i) => i)))}>
                    <IconDice className="size-4" /> Tirage
                  </button>
                </div>
              </div>
              <ol className="grid grid-cols-2 gap-1.5 text-sm sm:grid-cols-3">
                {order.map((i, k) => (
                  <li key={i} className="flex items-center gap-2 truncate rounded-lg bg-surface-2 px-2.5 py-1.5">
                    <span className="w-5 text-xs font-medium text-ink-3 tabular-nums">{k + 1}</span>
                    <span className="truncate">{teams[i]}</span>
                  </li>
                ))}
              </ol>
              <Switch label="Petite finale" hint="Un match pour la 3e place" checked={thirdPlace} onChange={setThirdPlace} />
            </div>
          )}
        </div>
      )}

      {step === 3 && input && (
        <div className="rise space-y-5">
          <Summary preview={preview} start={startDate} courts={courts} courtsLabel={courtsLabel} />

          <div className="grid grid-cols-2 gap-3">
            <Field label={cap(courtsLabel)} hint="Matchs joués en même temps">
              <Stepper value={courts} min={1} max={40} onChange={setCourts} />
            </Field>
            <Field label="Durée d'un match" hint={`Conseillé en ${sport?.name.toLowerCase()} : ${sport?.rules.defaults.matchDuration} min`}>
              <Stepper value={matchDuration} min={1} max={240} onChange={setMatchDuration} suffix="min" />
            </Field>
            <Field label="Pause entre deux matchs" hint={`Changement d'équipes sur un ${courtLabel}`}>
              <Stepper value={breakDuration} min={0} max={120} onChange={setBreakDuration} suffix="min" />
            </Field>
            <Field label="Repos minimum" hint="Entre deux matchs d'une même équipe">
              <Stepper value={minRest} min={0} max={240} onChange={setMinRest} suffix="min" />
            </Field>
          </div>

          <div className="card space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <IconClock className="size-4 text-ink-3" />
              <span className="mr-auto text-sm font-medium">Vous devez avoir fini à une heure précise ?</span>
              <input type="time" className="input h-10 w-32" value={deadline} onChange={(e) => (setDeadline(e.target.value), setFitMsg(null))} aria-label="Heure de fin souhaitée" />
              <button className="btn-outline h-10 text-sm" disabled={!deadline} onClick={fit}>
                Ajuster les matchs
              </button>
            </div>
            {fitMsg && <p className="text-sm text-ink-2">{fitMsg}</p>}
          </div>

          <div className="card divide-y divide-line text-sm">
            <RecapRow label="Tournoi" onEdit={() => setStep(0)}>
              <span className="font-medium">{effectiveName}</span>
              <span className="block text-ink-3 first-letter:uppercase">
                {sport?.name} · {startDate.toLocaleDateString("fr-FR", { dateStyle: "full" })} à {time}
              </span>
            </RecapRow>
            <RecapRow label="Équipes" onEdit={() => setStep(1)}>
              <span className="font-medium">{plural(n, "équipe")}</span>
              <span className="block truncate text-ink-3">{teams.join(", ")}</span>
            </RecapRow>
            <RecapRow label="Format" onEdit={() => setStep(2)}>
              <span className="font-medium">{FORMAT_LABEL[format]}</span>
              <span className="block text-ink-3">
                {format !== "knockout" && plural(pools.length, "poule")}
                {format === "pools_knockout" && qual && ` · ${qual.detail}`}
                {format !== "pools" && thirdPlace && " · petite finale"}
              </span>
            </RecapRow>
          </div>
          <p className="text-xs text-ink-3">Après la création, vous pourrez encore renommer les équipes, déplacer des matchs dans le planning et modifier les règles.</p>
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
        <div className="mx-auto max-w-3xl space-y-2">
          {undo && (
            <div className="rise mx-auto flex w-fit items-center gap-3 rounded-full bg-ink py-2 pr-2 pl-4 text-sm text-canvas shadow-lg">
              {undo.text}
              <button
                className="rounded-full bg-canvas/15 px-3 py-1 font-medium hover:bg-canvas/25"
                onClick={() => {
                  undo.restore();
                  setUndo(null);
                }}
              >
                Annuler
              </button>
            </div>
          )}
          {blocker && step > 0 && (n > 0 || step > 1) ? (
            <p className="rounded-full bg-danger-soft px-4 py-2 text-center text-xs font-medium text-danger">{blocker}</p>
          ) : (
            step > 0 &&
            preview && (
              <p className="text-center text-xs text-ink-2">
                <span className="rounded-full bg-surface/90 px-3 py-1.5 backdrop-blur">
                  {plural(n, "équipe")} · {preview.matches} matchs · fin vers <span className="font-semibold text-ink">{hhmm(preview.end)}</span>
                </span>
              </p>
            )
          )}
          <div className="flex gap-2 rounded-full border border-line bg-surface/90 p-1.5 shadow-[0_8px_30px_rgb(0_0_0/0.1)] backdrop-blur-xl">
            {step > 0 && (
              <button className="btn-quiet" onClick={() => setStep(step - 1)}>
                <IconArrowLeft className="size-4" /> Retour
              </button>
            )}
            {step < 3 ? (
              <button className="btn-primary flex-1" disabled={!!blocker} onClick={next}>
                Continuer <IconArrowRight className="size-4" />
              </button>
            ) : (
              <button className="btn-accent flex-1 font-semibold" disabled={pending || !!invalid} onClick={submit}>
                {pending ? "Création…" : "Créer le tournoi"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RecapRow({ label, onEdit, children }: { label: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 p-4">
      <span className="eyebrow w-16 shrink-0 pt-0.5">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
      <button className="shrink-0 text-sm font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline" onClick={onEdit}>
        Modifier
      </button>
    </div>
  );
}

function Summary({ preview, start, courts, courtsLabel }: { preview: ReturnType<typeof previewEnd>; start: Date; courts: number; courtsLabel: string }) {
  if (!preview) return null;
  const minutes = (preview.end.getTime() - start.getTime()) / 60000;
  const nextDay = preview.end.toDateString() !== start.toDateString();
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-4 rounded-2xl bg-ink p-5 text-canvas">
        <Stat label="Matchs" value={`${preview.matches}`} />
        <Stat label="Durée" value={fmtDuration(minutes)} sub={`sur ${courts} ${courtsLabel}`} />
        <Stat label="Fin estimée" value={hhmm(preview.end)} accent />
      </div>
      {nextDay && <p className="rounded-xl bg-warn-soft px-4 py-2.5 text-sm font-medium text-warn">Le tournoi finirait le lendemain : ajoutez des {courtsLabel}, raccourcissez les matchs ou fixez une heure de fin ci-dessous.</p>}
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-medium tracking-[0.08em] uppercase opacity-50">{label}</div>
      <div className={`mt-0.5 text-2xl font-semibold tracking-tight tabular-nums ${accent ? "text-accent" : ""}`}>{value}</div>
      {sub && <div className="text-xs opacity-50">{sub}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ Glisser-déposer des poules

function PoolBoard({ pools, teams, onChange }: { pools: number[][]; teams: string[]; onChange: (p: number[][]) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const team = Number(e.active.id);
    const target = Number(String(e.over.id).replace("pool-", ""));
    const from = pools.findIndex((p) => p.includes(team));
    if (from === target || from < 0) return;
    onChange(pools.map((p, i) => (i === from ? p.filter((x) => x !== team) : i === target ? [...p, team] : p)));
  };
  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {pools.map((p, i) => (
          <PoolDrop key={i} index={i} size={p.length} single={pools.length === 1}>
            {p.map((t) => (
              <TeamChip key={t} id={t} name={teams[t]} />
            ))}
          </PoolDrop>
        ))}
      </div>
    </DndContext>
  );
}

function PoolDrop({ index, size, single, children }: { index: number; size: number; single: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `pool-${index}` });
  const bad = !single && (size < POOL_MIN || size > POOL_MAX);
  return (
    <div ref={setNodeRef} className={`min-h-24 rounded-xl p-2.5 transition ${isOver ? "bg-accent-soft ring-2 ring-ink" : "bg-surface-2"}`}>
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-sm font-semibold">Poule {poolName(index)}</span>
        <span className={`text-xs ${bad ? "font-medium text-warn" : "text-ink-3"}`}>{size} équipes</span>
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function TeamChip({ id, name }: { id: number; name: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: String(id) });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={`cursor-grab touch-none rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm font-medium select-none ${
        isDragging ? "relative z-50 cursor-grabbing border-ink shadow-xl" : "hover:border-line-strong"
      }`}
    >
      {name}
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function swap<T>(arr: T[], i: number, j: number): T[] {
  const a = [...arr];
  [a[i], a[j]] = [a[j], a[i]];
  return a;
}
