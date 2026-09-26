"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { moveMatchAction, swapMatchesAction } from "@/app/actions";
import { IconAlert, IconPencil, IconSwap } from "./Icons";
import { Notice } from "./TopBar";
import { Choice, ErrorText } from "./ui";

export interface PlanItem {
  id: string;
  label: string;
  home: string;
  away: string;
  homeId: string | null;
  awayId: string | null;
  courtId: string | null;
  scheduledAt: string | null;
  status: "scheduled" | "live" | "finished";
}

interface Props {
  items: PlanItem[];
  courts: { id: string; name: string }[];
  timezone: string;
  matchDuration: number;
  courtLabel?: string;
}

const hhmm = (iso: string, tz: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: tz });
const toMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

export function PlanningEditor({ items, courts, timezone, matchDuration, courtLabel = "terrain" }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [swapFrom, setSwapFrom] = useState<string | null>(null);
  const [view, setView] = useState<"time" | "court">("time");
  const [error, setError] = useState<string | null>(null);

  const conflicts = useMemo(() => findConflicts(items, matchDuration), [items, matchDuration]);
  const courtName = (id: string | null) => courts.find((c) => c.id === id)?.name ?? "–";
  const sorted = [...items].sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? null : (r.error ?? "Erreur"));
      setEditing(null);
      setSwapFrom(null);
      router.refresh();
    });

  const onPick = (it: PlanItem) => {
    if (!swapFrom) return;
    if (swapFrom === it.id) return setSwapFrom(null);
    act(() => swapMatchesAction(swapFrom, it.id));
  };

  const groups =
    view === "time"
      ? groupBy(sorted, (i) => (i.scheduledAt ? hhmm(i.scheduledAt, timezone) : "Non planifié"))
      : courts.map((c) => [c.name, sorted.filter((i) => i.courtId === c.id)] as [string, PlanItem[]]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Choice
          options={[
            { value: "time", label: "Par horaire" },
            { value: "court", label: `Par ${courtLabel}` },
          ]}
          value={view}
          onChange={setView}
        />
        <p className="text-[13px] text-ink-3">
          {pending ? (
            "Enregistrement…"
          ) : (
            <>
              <IconPencil className="inline size-3.5 align-[-2px]" /> modifier l&apos;horaire · <IconSwap className="inline size-3.5 align-[-2px]" /> échanger deux matchs
            </>
          )}
        </p>
      </div>

      {swapFrom && (
        <div className="sticky top-[7.5rem] z-10 flex items-center gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-canvas shadow-lg">
          <IconSwap className="size-4 shrink-0" />
          <span className="flex-1">Touchez le match avec lequel échanger.</span>
          <button className="rounded-full px-2 py-1 font-medium opacity-70 hover:opacity-100" onClick={() => setSwapFrom(null)}>
            Annuler
          </button>
        </div>
      )}
      {conflicts.size > 0 && (
        <Notice tone="danger">
          <span className="flex items-center gap-2">
            <IconAlert className="size-4 shrink-0" />
            {conflicts.size} match(s) en conflit : même équipe ou même {courtLabel} sur des créneaux qui se chevauchent.
          </span>
        </Notice>
      )}
      <ErrorText>{error}</ErrorText>

      {groups.map(([title, list]) =>
        list.length ? (
          <section key={title} className="space-y-2">
            <h3 className="eyebrow tabular-nums">{title}</h3>
            <div className="card divide-y divide-line overflow-hidden">
              {list.map((it) => {
                const selectable = !!swapFrom && swapFrom !== it.id && it.status === "scheduled";
                return (
                  <div
                    key={it.id}
                    onClick={() => selectable && onPick(it)}
                    className={`relative px-4 py-3 transition ${selectable ? "cursor-pointer hover:bg-accent-soft" : ""} ${swapFrom === it.id ? "bg-accent-soft" : ""} ${
                      swapFrom && !selectable && swapFrom !== it.id ? "opacity-40" : ""
                    }`}
                  >
                    {conflicts.has(it.id) && <span className="absolute inset-y-0 left-0 w-[3px] bg-danger" />}
                    <div className="flex items-center gap-4">
                      <div className="w-16 shrink-0">
                        {view === "time" ? (
                          <div className="truncate text-sm font-medium">{courtName(it.courtId)}</div>
                        ) : (
                          <div className="text-sm font-medium tabular-nums">{it.scheduledAt ? hhmm(it.scheduledAt, timezone) : "--:--"}</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 text-sm">
                        {it.label && <div className="eyebrow truncate">{it.label}</div>}
                        <div className="truncate">
                          {it.home} <span className="px-1 text-ink-3">vs</span> {it.away}
                        </div>
                      </div>
                      {it.status === "scheduled" && !swapFrom && (
                        <div className="flex shrink-0 gap-0.5">
                          <button
                            className={`btn-icon ${editing === it.id ? "bg-surface-2 text-ink" : ""}`}
                            onClick={() => setEditing(editing === it.id ? null : it.id)}
                            aria-label="Modifier"
                            title="Modifier l'horaire ou le terrain"
                          >
                            <IconPencil className="size-4" />
                          </button>
                          <button className="btn-icon" onClick={() => setSwapFrom(it.id)} aria-label="Échanger" title="Échanger avec un autre match">
                            <IconSwap className="size-4" />
                          </button>
                        </div>
                      )}
                      {it.status === "live" && <span className="chip bg-live-soft text-live">En cours</span>}
                      {it.status === "finished" && <span className="chip text-ink-3">Terminé</span>}
                    </div>
                    {editing === it.id && it.scheduledAt && (
                      <EditForm
                        it={it}
                        courts={courts}
                        timezone={timezone}
                        disabled={pending}
                        onSave={(time, courtId, cascade) => {
                          const delta = toMin(time) - toMin(hhmm(it.scheduledAt!, timezone));
                          const iso = new Date(new Date(it.scheduledAt!).getTime() + delta * 60000).toISOString();
                          act(() => moveMatchAction(it.id, iso, courtId, cascade));
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null,
      )}
    </div>
  );
}

function EditForm({
  it,
  courts,
  timezone,
  disabled,
  onSave,
}: {
  it: PlanItem;
  courts: { id: string; name: string }[];
  timezone: string;
  disabled: boolean;
  onSave: (time: string, courtId: string, cascade: boolean) => void;
}) {
  const [time, setTime] = useState(hhmm(it.scheduledAt!, timezone));
  const [court, setCourt] = useState(it.courtId ?? courts[0]?.id);
  const [cascade, setCascade] = useState(false);
  return (
    <div className="rise mt-3 grid gap-3 rounded-xl bg-surface-2 p-3 sm:grid-cols-[8rem_1fr] sm:items-center">
      <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Horaire" />
      <select className="input" value={court} onChange={(e) => setCourt(e.target.value)} aria-label="Lieu">
        {courts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <label className={`flex items-center gap-2 text-sm sm:col-span-1 ${court !== it.courtId ? "opacity-40" : ""}`}>
        <input type="checkbox" className="size-4 accent-[var(--ink)]" checked={cascade} disabled={court !== it.courtId} onChange={(e) => setCascade(e.target.checked)} />
        Décaler aussi les suivants
      </label>
      <button className="btn-primary h-10" disabled={disabled} onClick={() => onSave(time, court, cascade && court === it.courtId)}>
        Enregistrer
      </button>
    </div>
  );
}

function groupBy<T>(list: T[], key: (t: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const x of list) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return [...m];
}

function findConflicts(items: PlanItem[], duration: number): Set<string> {
  const res = new Set<string>();
  const active = items.filter((i) => i.scheduledAt && i.status !== "finished");
  for (let a = 0; a < active.length; a++)
    for (let b = a + 1; b < active.length; b++) {
      const x = active[a];
      const y = active[b];
      const overlap = Math.abs(new Date(x.scheduledAt!).getTime() - new Date(y.scheduledAt!).getTime()) < duration * 60000;
      if (!overlap) continue;
      const teams = [x.homeId, x.awayId].filter(Boolean);
      const shared = [y.homeId, y.awayId].some((t) => t && teams.includes(t));
      if (shared || (x.courtId && x.courtId === y.courtId)) {
        res.add(x.id);
        res.add(y.id);
      }
    }
  return res;
}
