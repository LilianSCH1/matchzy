"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createTournamentAction } from "@/app/actions";
import { validateInput, type TournamentInput } from "@/lib/build";
import { distributeRandom, distributeSeeded, suggestPoolCount, validPoolCounts } from "@/lib/pools";
import type { Format, Sport } from "@/lib/types";
import { defaultQualifierOption, fitMatchDuration, MIN_TEAMS, previewEnd, qualifierOptions, recommendFormat, type QualifierOption } from "@/lib/wizard";
import { IconArrowLeft, IconArrowRight } from "./Icons";
import { toast, useConfirm } from "./feedback";
import { FORMATS, hhmm, plural, suggestName, todayLocal } from "./wizard/shared";
import { WizardStepFormat } from "./wizard/WizardStepFormat";
import { WizardStepReview } from "./wizard/WizardStepReview";
import { WizardStepTeams } from "./wizard/WizardStepTeams";
import { WizardStepTournament } from "./wizard/WizardStepTournament";

const STEPS = ["Tournoi", "Équipes", "Format", "Horaires"];
const STEP_TITLES = ["Le tournoi", "Les équipes", "Le format", "Horaires et terrains"];
const STEP_HINTS = [
  "Le sport, le jour et l'heure du premier match. Tout reste modifiable.",
  "Tapez ou collez vos équipes. Pas encore les noms ? Créez des équipes provisoires, vous les renommerez plus tard.",
  "Comparez les formules : le nombre de matchs et l'heure de fin se calculent en direct.",
  "Réglez le rythme et vérifiez l'heure de fin, puis créez le tournoi.",
];
const DRAFT_KEY = "matchzy:nouveau-tournoi";

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
        <div className="rise flex items-center justify-between gap-3 rounded-[10px] bg-accent-soft px-4 py-3 text-sm">
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
        <WizardStepTournament
          sports={sports}
          sport={sport}
          sportId={sportId}
          pickSport={pickSport}
          name={name}
          setName={setName}
          date={date}
          setDate={setDate}
          time={time}
          setTime={setTime}
          next={next}
        />
      )}

      {step === 1 && (
        <WizardStepTeams
          teams={teams}
          setTeams={setTeams}
          entry={entry}
          setEntry={setEntry}
          notice={notice}
          setNotice={setNotice}
          placeholderCount={placeholderCount}
          setPlaceholderCount={setPlaceholderCount}
          removeTeams={removeTeams}
          next={next}
        />
      )}

      {step === 2 && (
        <WizardStepFormat
          teams={teams}
          format={format}
          setFormatChoice={setFormatChoice}
          previews={previews}
          startDate={startDate}
          counts={counts}
          poolCount={poolCount}
          setPoolChoice={setPoolChoice}
          pools={pools}
          setPools={setPools}
          distMode={distMode}
          setDistMode={setDistMode}
          qualOptions={qualOptions}
          qual={qual}
          setQualChoice={setQualChoice}
          thirdPlace={thirdPlace}
          setThirdPlace={setThirdPlace}
          order={order}
          setKoOrder={setKoOrder}
        />
      )}

      {step === 3 && input && (
        <WizardStepReview
          sport={sport}
          preview={preview}
          startDate={startDate}
          time={time}
          courts={courts}
          setCourts={setCourts}
          courtsLabel={courtsLabel}
          courtLabel={courtLabel}
          matchDuration={matchDuration}
          setMatchDuration={setMatchDuration}
          breakDuration={breakDuration}
          setBreakDuration={setBreakDuration}
          minRest={minRest}
          setMinRest={setMinRest}
          deadline={deadline}
          setDeadline={setDeadline}
          fitMsg={fitMsg}
          setFitMsg={setFitMsg}
          fit={fit}
          effectiveName={effectiveName}
          teams={teams}
          format={format}
          pools={pools}
          qual={qual}
          thirdPlace={thirdPlace}
          setStep={setStep}
          error={error}
        />
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
