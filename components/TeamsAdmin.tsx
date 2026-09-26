"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateTeamAction, withdrawTeamAction } from "@/app/actions";
import { IconCheck, IconMinus, IconPencil, IconPlus, IconX } from "./Icons";
import { toast, useConfirm } from "./feedback";
import { ErrorText } from "./ui";

interface TeamItem {
  id: string;
  name: string;
  pool: string | null;
  withdrawn: boolean;
  fairPlay: number;
}

export function TeamsAdmin({ teams }: { teams: TeamItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [dialog, ask] = useConfirm();

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? null : (r.error ?? "Erreur"));
      if (r.ok && success) toast(success);
      setRenaming(null);
      router.refresh();
    });

  const pools = [...new Set(teams.map((t) => t.pool ?? ""))].sort();
  return (
    <div className="space-y-8">
      <ErrorText>{error}</ErrorText>
      {dialog}
      <div className="grid gap-8 md:grid-cols-2">
        {pools.map((p) => (
          <section key={p} className="space-y-3">
            {p && <h3 className="eyebrow">Poule {p}</h3>}
            <div className="card divide-y divide-line">
              {teams
                .filter((t) => (t.pool ?? "") === p)
                .map((t) => (
                  <div key={t.id} className="space-y-2 px-4 py-3">
                    <div className="flex h-9 items-center gap-2">
                      {renaming === t.id ? (
                        <form
                          className="flex flex-1 items-center gap-1"
                          onSubmit={(e) => {
                            e.preventDefault();
                            act(() => updateTeamAction(t.id, { name }), "Nom enregistré.");
                          }}
                        >
                          <input className="input h-9 flex-1 px-3" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setRenaming(null)} autoFocus aria-label="Nouveau nom" />
                          <button className="btn-icon bg-ink text-canvas hover:bg-ink hover:text-canvas" disabled={pending} aria-label="Valider">
                            <IconCheck className="size-4" />
                          </button>
                          <button type="button" className="btn-icon" onClick={() => setRenaming(null)} aria-label="Annuler">
                            <IconX className="size-4" />
                          </button>
                        </form>
                      ) : (
                        <>
                          <span className={`min-w-0 flex-1 truncate font-medium ${t.withdrawn ? "text-ink-3 line-through" : ""}`}>{t.name}</span>
                          {t.withdrawn && <span className="chip bg-warn-soft text-warn">Abandon</span>}
                          <button
                            className="btn-icon"
                            aria-label={`Renommer ${t.name}`}
                            title="Renommer"
                            onClick={() => {
                              setRenaming(t.id);
                              setName(t.name);
                            }}
                          >
                            <IconPencil className="size-4" />
                          </button>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-ink-3">Fair-play</span>
                      <div className="flex items-center rounded-full border border-line">
                        <button
                          className="btn-icon size-7"
                          disabled={pending || t.fairPlay <= 0}
                          onClick={() => act(() => updateTeamAction(t.id, { fair_play: t.fairPlay - 1 }))}
                          aria-label="Retirer une pénalité"
                        >
                          <IconMinus className="size-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold tabular-nums">{t.fairPlay}</span>
                        <button className="btn-icon size-7" disabled={pending} onClick={() => act(() => updateTeamAction(t.id, { fair_play: t.fairPlay + 1 }))} aria-label="Ajouter une pénalité">
                          <IconPlus className="size-3.5" />
                        </button>
                      </div>
                      <span className="flex-1" />
                      {t.withdrawn ? (
                        <button className="btn-ghost h-8 px-3 text-[13px]" disabled={pending} onClick={() => act(() => withdrawTeamAction(t.id, false), `${t.name} est réintégrée.`)}>
                          Réintégrer
                        </button>
                      ) : (
                        <button
                          className="btn-quiet h-8 px-3 text-[13px] text-ink-3 hover:bg-danger-soft hover:text-danger"
                          disabled={pending}
                          onClick={async () =>
                            (await ask({
                              title: `Abandon de ${t.name} ?`,
                              body: "Tous ses matchs non joués seront perdus par forfait et l'équipe sera classée dernière de sa poule. Vous pourrez la réintégrer ensuite.",
                              confirmLabel: "Déclarer l'abandon",
                              tone: "danger",
                            })) && act(() => withdrawTeamAction(t.id, true), `Abandon de ${t.name} enregistré.`)
                          }
                        >
                          Abandon…
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
