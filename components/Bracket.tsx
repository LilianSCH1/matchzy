import { roundName } from "@/lib/bracket";
import type { Match } from "@/lib/types";
import { fmtTime, type View } from "@/lib/view";
import { IconTrophy } from "./Icons";

function Slot({ name, score, win, lose, pending, big }: { name: string; score: string | null; win: boolean; lose: boolean; pending: boolean; big?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 px-3 ${big ? "py-2" : "py-1.5"}`}>
      <span className={`flex min-w-0 items-center gap-2 truncate ${win ? "font-bold" : "font-medium"} ${lose ? "text-ink-3" : ""} ${pending ? "text-ink-3" : ""}`}>
        {win && <span className="h-3.5 w-1 shrink-0 rounded-full bg-ok" />}
        <span className="truncate">{name}</span>
      </span>
      <span className={` text-[1.15em] font-bold tabular-nums ${win ? "" : "text-ink-3"}`}>{score ?? ""}</span>
    </div>
  );
}

function BracketMatch({ m, v, big }: { m: Match; v: View; big?: boolean }) {
  const size = big ? "text-base" : "text-[13px]";
  if (m.is_bye)
    return (
      <div className={`rounded-[10px] border border-dashed border-line-strong ${size}`}>
        <Slot name={v.home(m)} score={null} win={false} lose={false} pending={!m.home_team_id} big={big} />
        <div className="px-3 pb-2 text-[11px] font-bold text-ink-3">Exempté · qualifié d&apos;office</div>
      </div>
    );
  const done = m.status !== "scheduled";
  const live = m.status === "live";
  const tb = m.shootout && m.home_score === m.away_score;
  const w = m.winner_team_id;
  return (
    <div className={`overflow-hidden rounded-[10px] border bg-surface shadow-card ${live ? "border-live/60 ring-2 ring-live/20" : "border-line"} ${size}`}>
      <div className="flex justify-between gap-2 border-b border-dashed border-line-strong bg-surface-2/60 px-3 py-1 text-[11px] font-bold text-ink-3">
        <span className="truncate">{m.label}</span>
        <span className="whitespace-nowrap">
          {live ? (
            <span className="inline-flex items-center gap-1 font-medium text-live">
              <span className="live-dot size-1.5 rounded-full bg-live" /> En cours
            </span>
          ) : (
            `${fmtTime(m.scheduled_at, v.tz)} · ${v.court(m)}`
          )}
        </span>
      </div>
      <Slot
        name={v.home(m)}
        score={done ? `${m.home_score}${tb ? ` (${m.shootout!.home})` : ""}` : null}
        win={!!w && w === m.home_team_id}
        lose={!!w && w !== m.home_team_id}
        pending={!m.home_team_id}
        big={big}
      />
      <Slot
        name={v.away(m)}
        score={done ? `${m.away_score}${tb ? ` (${m.shootout!.away})` : ""}` : null}
        win={!!w && w === m.away_team_id}
        lose={!!w && w !== m.away_team_id}
        pending={!m.away_team_id}
        big={big}
      />
    </div>
  );
}

/**
 * Liaisons d'un match avec le tour suivant (dans l'espace de 2 rem entre deux colonnes) : une amorce vers la droite,
 * la moitié du trait vertical qui rejoint son voisin de paire, et une amorce à gauche depuis le tour précédent.
 * Elles se tracent à l'apparition, tour après tour, et s'allument en LED sur le chemin des vainqueurs.
 */
function Links({ m, first, last, pair }: { m: Match; first: boolean; last: boolean; pair: "top" | "bottom" | null }) {
  const decided = !!m.winner_team_id || undefined;
  const fed = !!(m.home_team_id || m.away_team_id) || undefined;
  return (
    <>
      {!first && <span aria-hidden data-lit={fed} className="br-line br-x top-1/2 -left-4 w-4 origin-left" />}
      {!last && (
        <>
          <span aria-hidden data-lit={decided} className="br-line br-x top-1/2 -right-4 w-4 origin-left" />
          {pair && (
            <span
              aria-hidden
              data-lit={decided}
              className={`br-line br-y right-[calc(-1rem-1px)] h-1/2 ${pair === "top" ? "top-1/2 origin-top" : "top-0 origin-bottom"}`}
            />
          )}
        </>
      )}
    </>
  );
}

export function Bracket({ v, big = false }: { v: View; big?: boolean }) {
  const ko = v.b.matches.filter((m) => m.phase === "knockout");
  if (!ko.length) return null;
  const rounds = Math.max(...ko.map((m) => m.bracket_round ?? 0));
  const third = ko.find((m) => m.bracket_round === rounds && m.bracket_slot === 1);
  const cols = Array.from({ length: rounds }, (_, i) =>
    ko.filter((m) => m.bracket_round === i + 1 && m !== third).sort((a, b) => (a.bracket_slot ?? 0) - (b.bracket_slot ?? 0)),
  );
  const champion = cols[rounds - 1]?.[0]?.winner_team_id;
  const width = big ? "w-72" : "w-52";
  return (
    <div className="space-y-4">
      {champion && (
        <div className="board relative flex items-center gap-4 overflow-hidden rounded-[10px] px-5 py-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full border-2 border-led/60 text-led shadow-[0_0_30px_rgb(255_176_0/0.35)]">
            <IconTrophy className="size-7" />
          </span>
          <div className="min-w-0">
            <div className="text-[12px] font-bold text-ink-2">Vainqueur du tournoi</div>
            <div className={`led truncate ${big ? "text-5xl" : "text-[40px]"} leading-tight`}>{v.teams.get(champion)}</div>
          </div>
        </div>
      )}
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-2 sm:-mx-5 sm:px-5">
        <div className="w-max">
          <div className="flex gap-8">
            {cols.map((list, i) => (
              <div key={i} className={`flex ${width} flex-col`}>
                <div className="display mb-3 border-b-2 border-accent pb-1 text-center text-[20px]">{roundName(i + 1, rounds)}</div>
                {/* Créneaux de hauteur égale : le centre d'un match tombe au milieu de ses deux matchs d'origine. */}
                <div className="flex flex-1 flex-col">
                  {list.map((m, j) => (
                    <div key={m.id} className="relative flex flex-1 items-center py-1.5" style={{ "--round": i } as React.CSSProperties}>
                      <Links m={m} first={i === 0} last={i === rounds - 1} pair={j % 2 === 0 ? (list[j + 1] ? "top" : null) : "bottom"} />
                      <div className="w-full">
                        <BracketMatch m={m} v={v} big={big} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {third && (
            <div className="mt-6 flex justify-end">
              <div className={width}>
                <div className="display mb-2 text-center text-[18px] text-ink-3">Petite finale</div>
                <BracketMatch m={third} v={v} big={big} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
