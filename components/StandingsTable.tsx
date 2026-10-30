import type { StandingRow } from "@/lib/standings";
import type { SportRules } from "@/lib/types";
import { RankCell } from "./RankCell";

/** Ligne prête à afficher : le rang à part (il porte la flèche de l'écran géant), le reste déjà rendu. */
export interface StandingsItem {
  id: string;
  rank: number;
  qualified: boolean;
  className: string;
  cells: React.ReactNode;
}

export function StandingsTable({
  title,
  rows,
  rules,
  qualified = 0,
  big = false,
  body,
}: {
  title: string;
  rows: StandingRow[];
  rules: SportRules;
  qualified?: number;
  big?: boolean;
  /** Corps du tableau sur mesure (l'écran géant y anime les changements de place). Composants serveur uniquement. */
  body?: (items: StandingsItem[]) => React.ReactNode;
}) {
  const sets = rules.scoreType === "sets";
  const th = `px-1.5 py-2 text-center font-bold ${big ? "w-14" : "w-10"}`;
  // G/N/P : masqués sur mobile et sur l'écran géant (plusieurs poules côte à côte), pour laisser la place aux noms.
  const hide = big ? "hidden" : "hidden sm:table-cell";
  // En sets, la colonne +/− cède aussi sa place sur mobile.
  const diffCls = sets && !big ? "hidden sm:table-cell" : "";
  const items: StandingsItem[] = rows.map((r) => {
    const q = r.rank <= qualified && !r.withdrawn;
    return {
      id: r.teamId,
      rank: r.rank,
      qualified: q,
      // Dernier qualifié : la ligne de qualification est tracée sous lui.
      className: `relative ${r.withdrawn ? "text-ink-3" : ""} ${q ? "bg-ok-soft/40" : ""} ${q && r.rank === qualified && rows.length > qualified ? "qual-cut" : ""}`,
      cells: (
        <>
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
          <td className={`px-1.5 pr-4 text-center font-bold tabular-nums ${big ? "text-2xl" : "text-lg"}`}>{r.points}</td>
        </>
      ),
    };
  });
  return (
    <div className="card overflow-hidden">
      <div className="board flex items-center justify-between px-4 py-2.5">
        <h3 className={`display text-ink ${big ? "text-[30px]" : "text-[22px]"}`}>{title}</h3>
        {qualified > 0 && (
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-ink-2">
            <span className="h-3 w-1 rounded-full bg-ok" /> qualifié{qualified > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <table className={`w-full ${big ? "text-lg" : "text-sm"}`}>
        <thead className={`border-b border-line bg-surface-2/60 font-bold text-ink-3 ${big ? "text-sm" : "text-[12px]"}`}>
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
        {body ? (
          body(items)
        ) : (
          <tbody className="divide-y divide-line">
            {items.map((r) => (
              <tr key={r.id} className={r.className}>
                <RankCell rank={r.rank} qualified={r.qualified} big={false} />
                {r.cells}
              </tr>
            ))}
          </tbody>
        )}
      </table>
    </div>
  );
}
