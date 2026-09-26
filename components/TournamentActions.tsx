"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { createDemoAction, deleteAllTournamentsAction, deleteTournamentAction } from "@/app/actions";
import { Spinner, toast, useConfirm } from "./feedback";
import { IconSparkle, IconTrash } from "./Icons";

export function DemoButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-quiet"
      disabled={pending}
      aria-busy={pending}
      onClick={() =>
        start(async () => {
          const r = await createDemoAction();
          if (r.error) return toast(r.error, "error");
          toast(`${r.count} tournois de démonstration créés, avec des matchs en cours.`);
          router.refresh();
        })
      }
    >
      {pending ? <Spinner /> : <IconSparkle className="size-4" />}
      {pending ? "Création de la démo…" : "Démo"}
    </button>
  );
}

/** Supprime un tournoi après confirmation. `icon` : bouton discret (cartes), sinon bouton rouge (zone dangereuse). */
export function DeleteTournamentButton({ id, name, variant = "full", redirectTo }: { id: string; name: string; variant?: "icon" | "full"; redirectTo?: string }) {
  const router = useRouter();
  const [dialog, ask] = useConfirm();
  const open = async () => {
    const ok = await ask({
      title: `Supprimer « ${name} » ?`,
      body: "Les équipes, les matchs, les scores et les codes arbitres seront effacés. Cette action est définitive.",
      confirmLabel: "Supprimer le tournoi",
      tone: "danger",
      action: async () => {
        const r = await deleteTournamentAction(id);
        return r.ok ? null : r.error;
      },
    });
    if (!ok) return;
    toast(`« ${name} » a été supprimé.`);
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  };
  return (
    <>
      {variant === "icon" ? (
        <button className="btn-icon relative z-10 hover:bg-danger-soft hover:text-danger" onClick={open} aria-label={`Supprimer ${name}`} title="Supprimer le tournoi">
          <IconTrash className="size-4" />
        </button>
      ) : (
        <button className="btn-danger" onClick={open}>
          <IconTrash className="size-4" /> Supprimer le tournoi
        </button>
      )}
      {dialog}
    </>
  );
}

export function DeleteAllButton({ count }: { count: number }) {
  const router = useRouter();
  const [dialog, ask] = useConfirm();
  const open = async () => {
    let deleted = 0;
    const ok = await ask({
      title: `Supprimer les ${count} tournois ?`,
      body: "Tous les tournois, à venir comme terminés, seront effacés avec leurs équipes et leurs résultats. Les sports et leurs règles sont conservés.",
      confirmLabel: "Tout supprimer",
      tone: "danger",
      requireText: "SUPPRIMER",
      action: async () => {
        const r = await deleteAllTournamentsAction();
        if (!r.ok) return r.error;
        deleted = r.count ?? 0;
      },
    });
    if (!ok) return;
    toast(deleted > 1 ? `${deleted} tournois supprimés.` : "Tournoi supprimé.");
    router.refresh();
  };
  return (
    <>
      <button className="btn-quiet h-9 px-3 text-sm text-ink-3 hover:bg-danger-soft hover:text-danger" onClick={open}>
        <IconTrash className="size-4" /> Tout supprimer
      </button>
      {dialog}
    </>
  );
}
