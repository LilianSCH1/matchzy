"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { renameCourtAction } from "@/app/actions";

export function CourtsAdmin({ courts, refereeUrl }: { courts: { id: string; name: string; code: string }[]; refereeUrl: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [names, setNames] = useState(Object.fromEntries(courts.map((c) => [c.id, c.name])));
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {courts.map((c) => (
          <div key={c.id} className="card flex items-center gap-3 p-2 pl-3">
            <input
              className="h-10 min-w-0 flex-1 rounded-lg bg-transparent px-2 font-medium outline-none hover:bg-surface-2 focus:bg-surface-2"
              value={names[c.id]}
              aria-label="Nom"
              onChange={(e) => setNames({ ...names, [c.id]: e.target.value })}
              onBlur={() =>
                names[c.id] !== c.name &&
                start(async () => {
                  const r = await renameCourtAction(c.id, names[c.id]);
                  if (!r.ok) alert(r.error);
                  router.refresh();
                })
              }
            />
            <div className="rounded-xl bg-surface-2 px-3 py-1.5 text-right">
              <div className="text-[10px] font-medium tracking-wide text-ink-3 uppercase">Code</div>
              <div className="font-mono text-xl font-semibold tracking-[0.2em]">{c.code}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-3">
        {pending ? "Enregistrement… " : "Touchez un nom pour le modifier. "}Les arbitres saisissent leur code sur <span className="font-mono text-ink-2">{refereeUrl}</span>
      </p>
    </div>
  );
}
