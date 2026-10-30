"use client";

import { useState } from "react";
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { poolName, POOL_MAX, POOL_MIN } from "@/lib/pools";

export function PoolBoard({ pools, teams, onChange }: { pools: number[][]; teams: string[]; onChange: (p: number[][]) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }));
  // Dernière équipe déposée : elle « atterrit » dans sa nouvelle poule (ressort court).
  const [landed, setLanded] = useState<number | null>(null);
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const team = Number(e.active.id);
    const target = Number(String(e.over.id).replace("pool-", ""));
    const from = pools.findIndex((p) => p.includes(team));
    if (from === target || from < 0) return;
    onChange(pools.map((p, i) => (i === from ? p.filter((x) => x !== team) : i === target ? [...p, team] : p)));
    setLanded(team);
    import("@/lib/client/fx").then((m) => m.fx.drop());
  };
  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {pools.map((p, i) => (
          <PoolDrop key={i} index={i} size={p.length} single={pools.length === 1}>
            {p.map((t) => (
              <TeamChip key={t} id={t} name={teams[t]} landed={t === landed} />
            ))}
          </PoolDrop>
        ))}
      </div>
    </DndContext>
  );
}

function PoolDrop({ index, size, single, children }: { index: number; size: number; single: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `pool-${index}` });
  const bad = !single && (size < POOL_MIN || size > POOL_MAX);
  return (
    <div ref={setNodeRef} className={`min-h-24 rounded-md p-2.5 transition ${isOver ? "bg-sport-glow ring-2 ring-sport" : "bg-surface-2"}`}>
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-sm font-semibold">Poule {poolName(index)}</span>
        <span className={`text-xs ${bad ? "font-medium text-warn" : "text-ink-3"}`}>{size} équipes</span>
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function TeamChip({ id, name, landed }: { id: number; name: string; landed: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: String(id) });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={`cursor-grab touch-none rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm font-medium select-none ${
        isDragging ? "drag-lift relative z-50 cursor-grabbing border-ink shadow-elev-3" : "hover:border-line-strong"
      } ${landed && !isDragging ? "chip-land" : ""}`}
    >
      {name}
    </div>
  );
}
