import { roundName } from "@/lib/bracket";
import type { Match } from "@/lib/types";
import { fmtTime, type View } from "@/lib/view";
import { IconTrophy } from "./Icons";

function Slot({ name, score, win, lose, pending, big }: { name: string; score: string | null; win: boolean; lose: boolean; pending: boolean; big?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 px-3 ${big ? "py-2" : "py-1.5"}`}>
      <span className={`flex min-w-0 items-center gap-2 truncate ${win ? "font-semibold" : ""} ${lose ? "text-ink-3" : ""} ${pending ? "text-ink-3" : ""}`}>
        {win && <span className="size-1.5 shrink-0 rounded-full bg-accent ring-1 ring-ink/20" />}
        <span className="truncate">{name}</span>
      </span>
      <span className={`tabular-nums ${win ? "font-semibold" : "text-ink-2"}`}>{score ?? ""}</span>
    </div>
  );
}

function BracketMatch({ m, v, big }: { m: Match; v: View; big?: boolean }) {
  const size = big ? "text-base" : "text-[13px]";
  if (m.is_bye)
    return (
      <div className={`rounded-xl border border-dashed border-line-strong ${size}`}>
        <Slot name={v.home(m)} score={null} win={false} lose={false} pending={!m.home_team_id} big={big} />
        <div className="px-3 pb-2 text-[11px] text-ink-3">Exempté · qualifié d&apos;office</div>
      </div>
    );
  const done = m.status !== "scheduled";
  const live = m.status === "live";
  const tb = m.shootout && m.home_score === m.away_score;
  const w = m.winner_team_id;
  return (
    <div className={`overflow-hidden rounded-xl border bg-surface ${live ? "border-live/50" : "border-line"} ${size}`}>
      <div className="flex justify-between gap-2 border-b border-line px-3 py-1 text-[11px] text-ink-3">
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

export function Bracket({ v, big = false }: { v: View; big?: boolean }) {
  const ko = v.b.matches.filter((m) => m.phase === "knockout");
  if (!ko.length) return null;
  const rounds = Math.max(...ko.map((m) => m.bracket_round ?? 0));
  const third = ko.find((m) => m.bracket_round === rounds && m.bracket_slot === 1);
  const cols = Array.from({ length: rounds }, (_, i) =>
    ko.filter((m) => m.bracket_round === i + 1 && m !== third).sort((a, b) => (a.bracket_slot ?? 0) - (b.bracket_slot ?? 0)),
  );
  const champion = cols[rounds - 1]?.[0]?.winner_team_id;
  return (
    <div className="space-y-4">
      {champion && (
        <div className="flex items-center gap-4 rounded-2xl bg-accent px-5 py-4 text-on-accent">
          <span className="grid size-11 place-items-center rounded-full bg-on-accent/10">
            <IconTrophy className="size-6" />
          </span>
          <div>
            <div className="text-xs font-medium tracking-wide uppercase opacity-60">Vainqueur</div>
            <div className={`font-semibold tracking-tight ${big ? "text-3xl" : "text-xl"}`}>{v.teams.get(champion)}</div>
          </div>
        </div>
      )}
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-2 sm:-mx-5 sm:px-5">
        <div className="flex min-w-max gap-4">
          {cols.map((list, i) => (
            <div key={i} className={`flex ${big ? "w-72" : "w-52"} flex-col`}>
              <div className="eyebrow mb-3 text-center">{roundName(i + 1, rounds)}</div>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {list.map((m) => (
                  <BracketMatch key={m.id} m={m} v={v} big={big} />
                ))}
                {i === rounds - 1 && third && (
                  <div className="mt-6">
                    <div className="eyebrow mb-2 text-center">Petite finale</div>
                    <BracketMatch m={third} v={v} big={big} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
