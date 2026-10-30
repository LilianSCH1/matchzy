import { MAX_TEAMS, MIN_TEAMS, parseTeams, placeholderTeams } from "@/lib/wizard";
import { IconDown, IconPlus, IconSparkle, IconUp, IconX } from "../Icons";
import { Stepper } from "../ui";
import { plural, swap } from "./shared";

interface Props {
  teams: string[];
  setTeams: (t: string[]) => void;
  entry: string;
  setEntry: (v: string) => void;
  notice: string | null;
  setNotice: (v: string | null) => void;
  placeholderCount: number;
  setPlaceholderCount: (n: number) => void;
  removeTeams: (next: string[], text: string) => void;
  next: () => void;
}

/** Étape 2 : saisie ou collage des équipes, équipes provisoires, ordre des têtes de série. */
export function WizardStepTeams({ teams, setTeams, entry, setEntry, notice, setNotice, placeholderCount, setPlaceholderCount, removeTeams, next }: Props) {
  const n = teams.length;

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

  return (
    <div className="space-y-5">
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
        <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-dashed border-line-strong p-4">
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
  );
}
