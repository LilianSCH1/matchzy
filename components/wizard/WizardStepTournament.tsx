import type { Sport } from "@/lib/types";
import { IconCheck } from "../Icons";
import { Field } from "../ui";
import { suggestName, todayLocal } from "./shared";

interface Props {
  sports: Sport[];
  sport: Sport | undefined;
  sportId: string;
  pickSport: (id: string) => void;
  name: string;
  setName: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  time: string;
  setTime: (v: string) => void;
  next: () => void;
}

/** Prochain quart d'heure, au moins 10 minutes après maintenant (format HH:MM). */
function nextQuarter(): string {
  const d = new Date(Date.now() + 10 * 60000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Étape 1 : sport, nom, date et heure du premier match. */
export function WizardStepTournament({ sports, sport, sportId, pickSport, name, setName, date, setDate, time, setTime, next }: Props) {
  return (
    <div className="space-y-7">
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
          className="input h-12 text-lg"
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
      {date === todayLocal() && time && new Date(`${date}T${time}`).getTime() < Date.now() && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
          <span>Cette heure est déjà passée : le tournoi démarrerait en retard.</span>
          <button type="button" className="font-semibold underline underline-offset-4" onClick={() => setTime(nextQuarter())}>
            Commencer à {nextQuarter()}
          </button>
        </div>
      )}
    </div>
  );
}
