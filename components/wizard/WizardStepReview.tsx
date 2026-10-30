import type { TournamentInput } from "@/lib/build";
import type { Format, Sport } from "@/lib/types";
import { fmtDuration, FORMAT_LABEL } from "@/lib/view";
import type { previewEnd, QualifierOption } from "@/lib/wizard";
import { IconClock } from "../Icons";
import { ErrorText, Field, Stepper } from "../ui";
import { AnimatedNumber } from "./AnimatedNumber";
import { ScheduleFrieze } from "./ScheduleFrieze";
import { cap, hhmm, plural } from "./shared";

interface Props {
  input: TournamentInput;
  sport: Sport | undefined;
  preview: ReturnType<typeof previewEnd>;
  startDate: Date;
  time: string;
  courts: number;
  setCourts: (n: number) => void;
  courtsLabel: string;
  courtLabel: string;
  matchDuration: number;
  setMatchDuration: (n: number) => void;
  breakDuration: number;
  setBreakDuration: (n: number) => void;
  minRest: number;
  setMinRest: (n: number) => void;
  deadline: string;
  setDeadline: (v: string) => void;
  fitMsg: string | null;
  setFitMsg: (v: string | null) => void;
  fit: () => void;
  effectiveName: string;
  teams: string[];
  format: Format;
  pools: number[][];
  qual: QualifierOption | null;
  thirdPlace: boolean;
  setStep: (s: number) => void;
  error: string | null;
}

/** Étape 4 : rythme des matchs, heure de fin visée et récapitulatif avant la création. */
export function WizardStepReview(props: Props) {
  const { input, sport, preview, startDate, time, courts, setCourts, courtsLabel, courtLabel, matchDuration, setMatchDuration, breakDuration, setBreakDuration } = props;
  const { minRest, setMinRest, deadline, setDeadline, fitMsg, setFitMsg, fit, effectiveName, teams, format, pools, qual, thirdPlace, setStep, error } = props;
  const n = teams.length;
  return (
    <div className="space-y-5">
      <Summary preview={preview} start={startDate} courts={courts} courtsLabel={courtsLabel} />
      <ScheduleFrieze input={input} courtsLabel={courtsLabel} />

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
          <span className="block text-ink-3 first-letter:">
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
      <div className="grid grid-cols-3 gap-4 rounded-[10px] bg-ink p-5 text-canvas">
        <Stat label="Matchs" value={<AnimatedNumber value={preview.matches} />} />
        <Stat label="Durée" value={fmtDuration(minutes)} sub={`sur ${courts} ${courtsLabel}`} />
        <Stat label="Fin estimée" value={hhmm(preview.end)} accent />
      </div>
      {nextDay && <p className="rounded-md bg-warn-soft px-4 py-2.5 text-sm font-medium text-warn">Le tournoi finirait le lendemain : ajoutez des {courtsLabel}, raccourcissez les matchs ou fixez une heure de fin ci-dessous.</p>}
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-medium opacity-50">{label}</div>
      <div className={`mt-0.5 text-2xl font-semibold tracking-tight tabular-nums ${accent ? "text-accent" : ""}`}>{value}</div>
      {sub && <div className="text-xs opacity-50">{sub}</div>}
    </div>
  );
}
