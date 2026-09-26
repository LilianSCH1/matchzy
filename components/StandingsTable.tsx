import type { StandingRow } from "@/lib/standings";
import type { SportRules } from "@/lib/types";

export function StandingsTable({
  title,
  rows,
  rules,
  qualified = 0,
  big = false,
}: {
  title: string;
  rows: StandingRow[];
  rules: SportRules;
  qualified?: number;
  big?: boolean;
}) {
  const sets = rules.scoreType === "sets";
  const th = "px-1.5 py-2 text-center font-medium";
  const hide = big ? "" : "hidden sm:table-cell";
  return (
    <div className="card overflow-hidden">
      <div className={`flex items-center justify-between px-4 ${big ? "py-3" : "py-3"}`}>
        <h3 className={`font-semibold tracking-tight ${big ? "text-xl" : "text-[15px]"}`}>{title}</h3>
        {qualified > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-ink-3">
            <span className="size-2 rounded-full bg-accent ring-1 ring-ink/10" /> qualifié{qualified > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <table className={`w-full ${big ? "text-lg" : "text-sm"}`}>
        <thead className={`border-y border-line bg-surface-2/50 text-ink-3 ${big ? "text-sm" : "text-[11px]"}`}>
          <tr>
            <th className={`${big ? "w-16" : "w-11"} py-2 pl-4 text-left font-medium`}>#</th>
            <th className="py-2 text-left font-medium">Équipe</th>
            <th className={th} title="Joués">
              J
            </th>
            <th className={`${th} ${hide}`} title="Gagnés">
              G
            </th>
            {rules.allowDraw && (
              <th className={`${th} ${hide}`} title="Nuls">
                N
              </th>
            )}
            <th className={`${th} ${hide}`} title="Perdus">
              P
            </th>
            {sets && (
              <th className={th} title="Sets gagnés-perdus">
                Sets
              </th>
            )}
            <th className={th} title={`Différence de ${rules.labels.scorePlural}`}>
              +/−
            </th>
            <th className={`${th} pr-4 text-ink-2`} title="Points">
              Pts
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => {
            const q = r.rank <= qualified && !r.withdrawn;
            return (
              <tr key={r.teamId} className={r.withdrawn ? "text-ink-3" : ""}>
                <td className={`pl-4 ${big ? "py-2.5" : "py-2"}`}>
                  <span
                    className={`inline-flex items-center justify-center rounded-full font-semibold tabular-nums ${big ? "size-8 text-base" : "size-6 text-xs"} ${
                      q ? "bg-accent text-on-accent" : "text-ink-3"
                    }`}
                  >
                    {r.rank}
                  </span>
                </td>
                <td className="max-w-0 truncate pr-2 font-medium">
                  <span className={r.withdrawn ? "line-through" : ""}>{r.name}</span>
                  {r.byLot && r.played > 0 && (
                    <span className="ml-1 text-ink-3" title="Départagé par tirage au sort">
                      🎲
                    </span>
                  )}
                  {r.withdrawn && <span className="ml-1.5 text-xs font-normal">abandon</span>}
                </td>
                <td className="px-1.5 text-center text-ink-2 tabular-nums">{r.played}</td>
                <td className={`px-1.5 text-center text-ink-2 tabular-nums ${hide}`}>{r.won}</td>
                {rules.allowDraw && <td className={`px-1.5 text-center text-ink-2 tabular-nums ${hide}`}>{r.drawn}</td>}
                <td className={`px-1.5 text-center text-ink-2 tabular-nums ${hide}`}>{r.lost}</td>
                {sets && (
                  <td className="px-1.5 text-center text-ink-2 tabular-nums">
                    {r.setsWon}-{r.setsLost}
                  </td>
                )}
                <td className="px-1.5 text-center text-ink-2 tabular-nums">{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
                <td className="px-1.5 pr-4 text-center font-semibold tabular-nums">{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
