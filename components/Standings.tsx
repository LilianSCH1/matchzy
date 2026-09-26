import { StandingsTable } from "./StandingsTable";
import { resolveTournament } from "@/lib/resolve";
import { ordinal, type View } from "@/lib/view";

export function Standings({ v, big = false }: { v: View; big?: boolean }) {
  const t = v.b.tournament;
  const r = resolveTournament(v.b);
  const q = t.format === "pools_knockout" ? t.qualifiers_per_pool : t.format === "pools" ? 1 : 0;
  const nthRank = t.qualifiers_per_pool + 1;
  const nth = t.best_extra > 0 ? r.nth.get(nthRank) : undefined;
  return (
    <div className={`grid gap-4 ${big ? "grid-cols-2" : "md:grid-cols-2"}`}>
      {v.b.pools.map((p) => (
        <StandingsTable key={p.id} title={`Poule ${p.name}`} rows={r.standings.get(p.id) ?? []} rules={t.rules} qualified={q} big={big} />
      ))}
      {nth && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3">
            <h3 className="text-[15px] font-semibold tracking-tight">Classement des {ordinal(nthRank)}s</h3>
            <p className="text-xs text-ink-3">
              {t.best_extra} qualifié{t.best_extra > 1 ? "s" : ""} · comparaison à la moyenne par match
            </p>
          </div>
          <ol className="divide-y divide-line border-t border-line text-sm">
            {nth.map((row, i) => (
              <li key={row.teamId} className="flex items-center gap-3 px-4 py-2">
                <span
                  className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold ${
                    i < t.best_extra ? "bg-accent text-on-accent" : "text-ink-3"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="flex-1 truncate font-medium">{row.name}</span>
                <span className="text-ink-2 tabular-nums">
                  {row.points} pts · {row.played} j · {row.diff > 0 ? "+" : ""}
                  {row.diff}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
