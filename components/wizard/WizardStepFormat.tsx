import { distributeRandom, distributeSeeded, poolSizes, shuffle } from "@/lib/pools";
import type { Format } from "@/lib/types";
import { fmtDuration, FORMAT_LABEL } from "@/lib/view";
import { recommendFormat, type previewEnd, type QualifierOption } from "@/lib/wizard";
import { IconCheck, IconDice } from "../Icons";
import { Choice, Switch } from "../ui";
import { PoolBoard } from "./PoolBoard";
import { FORMAT_HINT, FORMATS, hhmm, plural } from "./shared";

type DistMode = "random" | "seeded" | "manual";

interface Props {
  teams: string[];
  format: Format;
  setFormatChoice: (f: Format) => void;
  previews: Record<Format, ReturnType<typeof previewEnd>>;
  startDate: Date;
  counts: number[];
  poolCount: number;
  setPoolChoice: (k: number) => void;
  pools: number[][];
  setPools: (p: number[][]) => void;
  distMode: DistMode;
  setDistMode: (m: DistMode) => void;
  qualOptions: QualifierOption[];
  qual: QualifierOption | null;
  setQualChoice: (q: { q: number; extra: number }) => void;
  thirdPlace: boolean;
  setThirdPlace: (v: boolean) => void;
  order: number[];
  setKoOrder: (o: number[]) => void;
}

/** Étape 3 : formule (avec l'aperçu de chacune), poules, qualifiés, placement dans le tableau. */
export function WizardStepFormat(props: Props) {
  const { teams, format, setFormatChoice, previews, startDate, counts, poolCount, setPoolChoice, pools, setPools, distMode, setDistMode } = props;
  const { qualOptions, qual, setQualChoice, thirdPlace, setThirdPlace, order, setKoOrder } = props;
  const n = teams.length;
  return (
    <div className="rise space-y-5">
      <div className="grid gap-2 sm:grid-cols-3">
        {FORMATS.map((f) => {
          const on = format === f;
          const p = previews[f];
          return (
            <button
              key={f}
              onClick={() => setFormatChoice(f)}
              className={`relative flex flex-col rounded-[10px] border p-4 text-left transition ${on ? "border-ink bg-surface ring-1 ring-ink" : "border-line bg-surface hover:border-line-strong"}`}
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
                      className={`rounded-md px-3.5 py-2 text-left transition ${on ? "bg-ink text-canvas" : "border border-line bg-surface hover:border-line-strong"}`}
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
                  className={`flex items-center gap-3 rounded-md border px-4 py-3 text-left transition ${on ? "border-ink ring-1 ring-ink" : "border-line hover:border-line-strong"}`}
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
              <li key={i} className="flex items-center gap-2 truncate rounded-md bg-surface-2 px-2.5 py-1.5">
                <span className="w-5 text-xs font-medium text-ink-3 tabular-nums">{k + 1}</span>
                <span className="truncate">{teams[i]}</span>
              </li>
            ))}
          </ol>
          <Switch label="Petite finale" hint="Un match pour la 3e place" checked={thirdPlace} onChange={setThirdPlace} />
        </div>
      )}
    </div>
  );
}
