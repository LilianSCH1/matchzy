"use client";

import { useRouter } from "next/navigation";
import { IconDown, IconUsers } from "./Icons";

/** Filtre du programme par équipe, appliqué dès la sélection. */
export function TeamFilter({ base, teams, value }: { base: string; teams: { id: string; name: string }[]; value?: string }) {
  const router = useRouter();
  return (
    <div className="relative">
      <IconUsers className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
      <select
        aria-label="Filtrer par équipe"
        value={value ?? ""}
        onChange={(e) => router.push(`${base}?v=programme${e.target.value ? `&equipe=${e.target.value}` : ""}`, { scroll: false })}
        className="input appearance-none pr-10 pl-10"
      >
        <option value="">Toutes les équipes</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <IconDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-3" />
    </div>
  );
}
