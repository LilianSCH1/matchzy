"use client";

import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createTournamentAction } from "@/app/actions";
import { nextPow2 } from "@/lib/bracket";
import { buildTournament, estimatedEnd, validateInput, type TournamentInput } from "@/lib/build";
import { distributeRandom, distributeSeeded, poolName, poolSizes, POOL_MAX, POOL_MIN, shuffle, suggestPoolCount, validPoolCounts } from "@/lib/pools";
import type { Format, Sport } from "@/lib/types";
import { fmtDuration, FORMAT_LABEL } from "@/lib/view";
import { IconArrowLeft, IconArrowRight, IconCheck, IconDice, IconDown, IconPlus, IconUp, IconX } from "./Icons";
import { Choice, ErrorText, Field, Stepper, Switch } from "./ui";

const STEPS = ["Tournoi", "Équipes", "Format", "Validation"];
const STEP_TITLES = ["Le tournoi", "Les équipes", "Le format", "Récapitulatif"];
const STEP_HINTS = [
  "Nom, date, sport et rythme des matchs.",
  "L'ordre de la liste sert de classement des têtes de série.",
  "Poules, phase finale ou élimination directe. L'aperçu se met à jour en direct.",
  "Vérifiez, puis générez les poules, les matchs et le planning.",
];

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TournamentWizard({ sports }: { sports: Sport[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Étape 1
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [sportId, setSportId] = useState(sports[0]?.id ?? "");
  const sport = sports.find((s) => s.id === sportId) ?? sports[0];
  const [time, setTime] = useState("09:00");
  const [matchDuration, setMatchDuration] = useState(sport?.rules.defaults.matchDuration ?? 15);
  const [breakDuration, setBreakDuration] = useState(sport?.rules.defaults.breakDuration ?? 5);
  const [minRest, setMinRest] = useState(10);
  const [courts, setCourts] = useState(2);

  // Étape 2
  const [teams, setTeams] = useState<string[]>([]);
  const [paste, setPaste] = useState("");

  // Étape 3
  const [format, setFormat] = useState<Format>("pools_knockout");
  const [targetSize, setTargetSize] = useState(4);
  const [poolCount, setPoolCount] = useState(1);
  const [distMode, setDistMode] = useState<"random" | "seeded" | "manual">("random");
  const [pools, setPools] = useState<number[][]>([]);
  const [qualifiers, setQualifiers] = useState(2);
  const [bestExtra, setBestExtra] = useState(0);
  const [thirdPlace, setThirdPlace] = useState(true);
  const [koOrder, setKoOrder] = useState<number[]>([]);

  const L = sport?.rules.labels;

  const pickSport = (id: string) => {
    setSportId(id);
    const s = sports.find((x) => x.id === id);
    if (s) {
      setMatchDuration(s.rules.defaults.matchDuration);
      setBreakDuration(s.rules.defaults.breakDuration);
    }
  };

  // Recalcul de la répartition quand le nombre d'équipes ou de poules change
  const n = teams.length;
  const counts = useMemo(() => validPoolCounts(n), [n]);
  useEffect(() => {
    if (n >= 3) setPoolCount(suggestPoolCount(n, targetSize));
  }, [n, targetSize]);
  useEffect(() => {
    if (n < 2 || poolCount < 1) return setPools([]);
    setPools(distMode === "seeded" ? distributeSeeded(teams.map((_, i) => i), poolCount) : distributeRandom(n, poolCount));
    if (distMode === "manual") setDistMode("random");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, poolCount]);
  useEffect(() => setKoOrder(teams.map((_, i) => i)), [teams]);

  const input: TournamentInput | null = sport
    ? {
        name,
        date,
        sportId: sport.id,
        sportName: sport.name,
        rules: sport.rules,
        format,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        startAt: new Date(`${date}T${time || "09:00"}`).toISOString(),
        matchDuration,
        breakDuration,
        minRest,
        courts,
        teams: teams.map((t, i) => ({ name: t, seed: i + 1 })),
        pools: format === "knockout" ? [] : pools,
        qualifiersPerPool: qualifiers,
        bestExtra,
        thirdPlace,
        knockoutOrder: koOrder,
      }
    : null;

  const invalid = input ? validateInput(input) : "Aucun sport disponible.";
  const preview = useMemo(() => {
    if (!input || invalid) return null;
    try {
      return buildTournament(input, { id: "preview", slug: "preview" });
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalid, JSON.stringify(input)]);

  const addPasted = () => {
    const list = paste
      .split(/\r?\n/)
      .map((s) => s.replace(/^\s*\d+[.)-]\s*/, "").trim())
      .filter(Boolean);
    const existing = new Set(teams.map((t) => t.toLowerCase()));
    const fresh = list.filter((t) => !existing.has(t.toLowerCase()) && (existing.add(t.toLowerCase()), true));
    setTeams([...teams, ...fresh].slice(0, 64));
    setPaste("");
  };

  const canNext = [
    !!name.trim() && !!sport && courts >= 1 && matchDuration > 0,
    n >= 3 && n <= 64,
    !invalid,
    !invalid,
  ][step];

  const submit = () =>
    start(async () => {
      if (!input) return;
      const r = await createTournamentAction(input);
      if (r.error) setError(r.error);
      else router.push(`/t/${r.slug}/admin`);
    });

  const qualifiedCount = format === "knockout" ? n : pools.length * qualifiers + bestExtra;
  const courtsLabel = L?.courtPlural ?? "terrains";

  return (
    <div className="space-y-8 pb-32">
      <div className="space-y-4">
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <button
              key={s}
              onClick={() => i < step && setStep(i)}
              disabled={i >= step}
              aria-label={`Étape ${i + 1} : ${s}`}
              className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-ink" : "bg-line"} ${i < step ? "cursor-pointer hover:opacity-70" : ""}`}
            />
          ))}
        </div>
        <div key={step} className="rise">
          <div className="eyebrow">
            Étape {step + 1} sur {STEPS.length}
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{STEP_TITLES[step]}</h1>
          <p className="mt-1 text-[15px] text-ink-2">{STEP_HINTS[step]}</p>
        </div>
      </div>

      {step === 0 && (
        <div className="rise space-y-6">
          <input
            className="w-full border-b border-line bg-transparent pb-3 text-2xl font-medium tracking-tight outline-none placeholder:text-ink-3 focus:border-ink"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du tournoi"
            aria-label="Nom du tournoi"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Heure de début">
              <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>
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
            <p className="mt-2 text-xs text-ink-3">Les règles restent modifiables ensuite pour ce tournoi. « Personnalisé » part d&apos;un modèle générique.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label={`${cap(courtsLabel)}`}>
              <Stepper value={courts} min={1} max={40} onChange={setCourts} />
            </Field>
            <Field label="Durée d'un match">
              <Stepper value={matchDuration} min={1} max={240} onChange={setMatchDuration} suffix="min" />
            </Field>
            <Field label="Pause entre matchs">
              <Stepper value={breakDuration} min={0} max={120} onChange={setBreakDuration} suffix="min" />
            </Field>
            <Field label="Repos mini d'une équipe">
              <Stepper value={minRest} min={0} max={240} onChange={setMinRest} suffix="min" />
            </Field>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="rise space-y-5">
          <div className="card overflow-hidden focus-within:border-ink">
            <textarea
              className="block min-h-28 w-full resize-none bg-transparent px-4 pt-4 text-base outline-none placeholder:text-ink-3"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (paste.trim()) addPasted();
                }
              }}
              placeholder={"Nom de l'équipe, puis Entrée\nou collez une liste entière"}
              aria-label="Ajouter des équipes"
              autoFocus
            />
            <div className="flex items-center justify-between gap-3 px-4 pb-3">
              <span className="text-xs text-ink-3">Entrée pour ajouter · Maj+Entrée pour aller à la ligne</span>
              <button className="btn-primary h-9 px-4 text-sm" disabled={!paste.trim()} onClick={addPasted}>
                <IconPlus className="size-4" /> Ajouter
              </button>
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm">
              <span className="font-semibold tabular-nums">{n}</span> équipe{n > 1 ? "s" : ""}
              <span className="text-ink-3"> · de 3 à 64</span>
            </span>
            {n > 0 && (
              <button className="text-sm text-ink-3 hover:text-danger" onClick={() => confirm("Vider la liste ?") && setTeams([])}>
                Tout effacer
              </button>
            )}
          </div>
          {n > 0 && (
            <ol className="card divide-y divide-line overflow-hidden">
              {teams.map((t, i) => (
                <li key={i} className="group flex items-center gap-2 py-1 pr-1.5 pl-4">
                  <span className="w-6 text-sm font-medium text-ink-3 tabular-nums">{i + 1}</span>
                  <input
                    className="h-9 min-w-0 flex-1 bg-transparent outline-none"
                    value={t}
                    aria-label={`Équipe ${i + 1}`}
                    onChange={(e) => setTeams(teams.map((x, k) => (k === i ? e.target.value : x)))}
                  />
                  <button className="btn-icon size-8" disabled={i === 0} onClick={() => setTeams(swap(teams, i, i - 1))} aria-label="Monter">
                    <IconUp className="size-4" />
                  </button>
                  <button className="btn-icon size-8" disabled={i === n - 1} onClick={() => setTeams(swap(teams, i, i + 1))} aria-label="Descendre">
                    <IconDown className="size-4" />
                  </button>
                  <button className="btn-icon size-8 hover:bg-danger-soft hover:text-danger" onClick={() => setTeams(teams.filter((_, k) => k !== i))} aria-label="Supprimer">
                    <IconX className="size-4" />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="rise space-y-5">
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(FORMAT_LABEL) as Format[]).map((f) => {
              const on = format === f;
              return (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`relative rounded-2xl border p-4 text-left transition ${on ? "border-ink bg-surface ring-1 ring-ink" : "border-line bg-surface hover:border-line-strong"}`}
                >
                  <span className={`absolute top-4 right-4 grid size-5 place-items-center rounded-full ${on ? "bg-accent text-on-accent" : "border border-line-strong"}`}>
                    {on && <IconCheck className="size-3" />}
                  </span>
                  <div className="pr-6 font-semibold tracking-tight">{FORMAT_LABEL[f]}</div>
                  <div className="mt-1 text-[13px] text-ink-3">
                    {f === "pools" && "Classement final par poule"}
                    {f === "pools_knockout" && "Les meilleurs de chaque poule en tableau"}
                    {f === "knockout" && "Tableau direct, exemptions si besoin"}
                  </div>
                </button>
              );
            })}
          </div>

          {format !== "knockout" && (
            <div className="card space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Taille de poule visée">
                  <Choice full options={[3, 4, 5].map((s) => ({ value: s, label: `${s} équipes` }))} value={targetSize} onChange={setTargetSize} />
                </Field>
                <Field label="Nombre de poules">
                  <select className="input" value={poolCount} onChange={(e) => setPoolCount(Number(e.target.value))}>
                    {(counts.length ? counts : [poolCount]).map((k) => (
                      <option key={k} value={k}>
                        {k} poule{k > 1 ? "s" : ""} ({[...new Set(poolSizes(n, k))].sort().reverse().join(" ou ")} équipes)
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="label mb-0">Répartition</span>
                  <Choice
                    options={[
                      {
                        value: "random",
                        label: (
                          <>
                            <IconDice className="size-4" /> Aléatoire
                          </>
                        ),
                      },
                      { value: "seeded", label: "Têtes de série" },
                      ...(distMode === "manual" ? [{ value: "manual" as const, label: "Manuelle" }] : []),
                    ]}
                    value={distMode}
                    onChange={(mode) => {
                      if (mode === "manual") return;
                      setDistMode(mode);
                      setPools(mode === "seeded" ? distributeSeeded(teams.map((_, i) => i), poolCount) : distributeRandom(n, poolCount));
                    }}
                  />
                </div>
                <PoolBoard
                  pools={pools}
                  teams={teams}
                  onChange={(p) => {
                    setPools(p);
                    setDistMode("manual");
                  }}
                />
                <p className="mt-2 text-xs text-ink-3">Glissez une équipe d&apos;une poule à l&apos;autre pour ajuster à la main.</p>
              </div>
            </div>
          )}

          {format === "pools_knockout" && (
            <div className="card space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Qualifiés par poule">
                  <Stepper value={qualifiers} min={1} max={POOL_MAX} onChange={setQualifiers} />
                </Field>
                <Field label={`Meilleurs ${qualifiers + 1}es en plus`}>
                  <Stepper value={bestExtra} min={0} max={pools.length} onChange={setBestExtra} />
                </Field>
              </div>
              <Switch label="Petite finale" hint="Match pour la 3e place" checked={thirdPlace} onChange={setThirdPlace} />
            </div>
          )}

          {format === "knockout" && (
            <div className="card space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">Ordre des têtes de série</span>
                <div className="flex gap-1">
                  <button className="btn-ghost h-9 px-3.5 text-sm" onClick={() => setKoOrder(teams.map((_, i) => i))}>
                    Ordre de la liste
                  </button>
                  <button className="btn-ghost h-9 px-3.5 text-sm" onClick={() => setKoOrder(shuffle(teams.map((_, i) => i)))}>
                    <IconDice className="size-4" /> Tirage
                  </button>
                </div>
              </div>
              <ol className="grid grid-cols-2 gap-1.5 text-sm sm:grid-cols-3">
                {koOrder.map((i, k) => (
                  <li key={i} className="flex items-center gap-2 truncate rounded-lg bg-surface-2 px-2.5 py-1.5">
                    <span className="w-5 text-xs font-medium text-ink-3 tabular-nums">{k + 1}</span>
                    <span className="truncate">{teams[i]}</span>
                  </li>
                ))}
              </ol>
              <Switch label="Petite finale" hint="Match pour la 3e place" checked={thirdPlace} onChange={setThirdPlace} />
            </div>
          )}

          <Summary preview={preview} invalid={invalid} format={format} qualifiedCount={qualifiedCount} courtsLabel={courtsLabel} courts={courts} />
        </div>
      )}

      {step === 3 && input && (
        <div className="rise space-y-4">
          <div className="card divide-y divide-line">
            <div className="p-5">
              <div className="text-2xl font-semibold tracking-tight">{name}</div>
              <div className="mt-1 text-sm text-ink-2 first-letter:uppercase">
                {new Date(`${date}T12:00`).toLocaleDateString("fr-FR", { dateStyle: "full" })} à {time}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 p-5 text-sm sm:grid-cols-4">
              <Recap label="Sport" value={sport?.name ?? ""} />
              <Recap label="Équipes" value={String(n)} />
              <Recap label={cap(courtsLabel)} value={String(courts)} />
              <Recap label="Format" value={FORMAT_LABEL[format]} />
              <Recap label="Match" value={`${matchDuration} min`} />
              <Recap label="Pause" value={`${breakDuration} min`} />
              <Recap label="Repos mini" value={`${minRest} min`} />
              {format !== "knockout" && <Recap label="Poules" value={String(pools.length)} />}
            </dl>
          </div>
          <Summary preview={preview} invalid={invalid} format={format} qualifiedCount={qualifiedCount} courtsLabel={courtsLabel} courts={courts} />
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
        <div className="mx-auto max-w-3xl space-y-2">
          {step === 2 && invalid && <p className="rounded-full bg-danger-soft px-4 py-2 text-center text-xs font-medium text-danger">{invalid}</p>}
          <div className="flex gap-2 rounded-full border border-line bg-surface/90 p-1.5 shadow-[0_8px_30px_rgb(0_0_0/0.1)] backdrop-blur-xl">
            {step > 0 && (
              <button className="btn-quiet" onClick={() => setStep(step - 1)}>
                <IconArrowLeft className="size-4" /> Retour
              </button>
            )}
            {step < 3 ? (
              <button className="btn-primary flex-1" disabled={!canNext} onClick={() => setStep(step + 1)}>
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

function Recap({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function Summary({
  preview,
  invalid,
  format,
  qualifiedCount,
  courtsLabel,
  courts,
}: {
  preview: ReturnType<typeof buildTournament> | null;
  invalid: string | null;
  format: Format;
  qualifiedCount: number;
  courtsLabel: string;
  courts: number;
}) {
  if (!preview) return invalid ? <p className="rounded-2xl bg-danger-soft p-4 text-sm text-danger">{invalid}</p> : null;
  const t = preview.tournament;
  const played = preview.matches.filter((m) => !m.is_bye);
  const pool = played.filter((m) => m.phase === "pool").length;
  const ko = played.length - pool;
  const end = estimatedEnd(preview);
  const minutes = end ? (end.getTime() - new Date(t.start_at).getTime()) / 60000 : 0;
  const size = nextPow2(qualifiedCount);
  const byes = format !== "pools" ? size - qualifiedCount : 0;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-5 rounded-2xl bg-ink p-5 text-canvas sm:grid-cols-4">
      <Stat label="Matchs" value={`${played.length}`} sub={format === "pools_knockout" ? `${pool} en poule · ${ko} en finale` : undefined} />
      <Stat label="Durée estimée" value={fmtDuration(minutes)} sub={`sur ${courts} ${courtsLabel}`} />
      <Stat label="Fin estimée" value={end ? end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "–"} accent />
      {format !== "pools" && <Stat label="Tableau" value={`${qualifiedCount} qualifiés`} sub={byes ? `${byes} exemption${byes > 1 ? "s" : ""} · tableau de ${size}` : `tableau de ${size}`} />}
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
          <PoolDrop key={i} index={i} size={p.length}>
            {p.map((t) => (
              <TeamChip key={t} id={t} name={teams[t]} />
            ))}
          </PoolDrop>
        ))}
      </div>
    </DndContext>
  );
}

function PoolDrop({ index, size, children }: { index: number; size: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `pool-${index}` });
  const bad = size < POOL_MIN || size > POOL_MAX;
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
