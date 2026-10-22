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
  const th = `px-1.5 py-2 text-center font-bold ${big ? "w-14" : "w-10"}`;
  // G/N/P : masqués sur mobile et sur l'écran géant (plusieurs poules côte à côte), pour laisser la place aux noms.
  const hide = big ? "hidden" : "hidden sm:table-cell";
  // En sets, la colonne +/− cède aussi sa place sur mobile.
  const diffCls = sets && !big ? "hidden sm:table-cell" : "";
  return (
    <div className="card overflow-hidden">
      <div className="board flex items-center justify-between px-4 py-2.5">
        <h3 className={`display text-[#f3efe4] ${big ? "text-[30px]" : "text-[22px]"}`}>{title}</h3>
        {qualified > 0 && (
          <span className="flex items-center gap-1.5 font-cond text-[11px] font-bold tracking-[0.12em] text-[#b4afa3] uppercase">
            <span className="h-3 w-1 rounded-full bg-[#3ddc84]" /> qualifié{qualified > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <table className={`w-full ${big ? "text-lg" : "text-sm"}`}>
        <thead className={`border-b border-line bg-surface-2/60 font-cond font-bold tracking-[0.1em] text-ink-3 uppercase ${big ? "text-sm" : "text-[12px]"}`}>
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
            <th className={`${th} ${diffCls}`} title={`Différence de ${rules.labels.scorePlural}`}>
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
              <tr key={r.teamId} className={`relative ${r.withdrawn ? "text-ink-3" : ""} ${q ? "bg-ok-soft/40" : ""}`}>
                <td className={`relative pl-4 ${big ? "py-2.5" : "py-2"}`}>
                  {q && <span className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-ok" aria-hidden />}
                  <span
                    className={`inline-flex items-center justify-center rounded-[4px] font-cond font-extrabold tabular-nums ${big ? "size-8 text-lg" : "size-6 text-sm"} ${
                      q ? "bg-ok text-on-ok" : "text-ink-3"
                    }`}
                  >
                    {r.rank}
                  </span>
                </td>
                <td className="max-w-0 truncate pr-2 font-semibold">
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
                <td className={`px-1.5 text-center text-ink-2 tabular-nums ${diffCls}`}>{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
                <td className={`px-1.5 pr-4 text-center font-cond font-extrabold tabular-nums ${big ? "text-2xl" : "text-lg"}`}>{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
