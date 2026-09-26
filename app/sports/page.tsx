import Link from "next/link";
import { saveSportRulesAction } from "@/app/actions";
import { IconPlus } from "@/components/Icons";
import { RulesEditor } from "@/components/RulesEditor";
import { Page, TopBar } from "@/components/TopBar";
import { listSports } from "@/lib/server/data";
import { requireOrganizerPage } from "@/lib/server/page";
import { presetBySlug } from "@/lib/sports";

export const dynamic = "force-dynamic";

export default async function SportsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  await requireOrganizerPage("/sports");
  const { id } = await searchParams;
  const sports = await listSports();
  const selected = id === "new" ? null : (sports.find((s) => s.id === id) ?? sports[0]);
  const initial = selected?.rules ?? presetBySlug("personnalise")!.rules;
  const pill = (on: boolean) =>
    `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition ${on ? "bg-ink text-canvas" : "border border-line bg-surface text-ink-2 hover:text-ink"}`;
  return (
    <>
      <TopBar title="Sports & règles" subtitle="Modèles utilisés à la création des tournois" back="/" />
      <Page>
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:-mx-5 sm:flex-wrap sm:px-5">
          {sports.map((s) => (
            <Link key={s.id} href={`/sports?id=${s.id}`} className={pill(s.id === selected?.id)}>
              {s.name}
            </Link>
          ))}
          <Link href="/sports?id=new" className={pill(id === "new")}>
            <IconPlus className="size-4" /> Nouveau
          </Link>
        </div>
        <div className="space-y-4">
          <h2 className="text-3xl font-semibold tracking-tight">{selected ? selected.name : "Nouveau sport"}</h2>
          <RulesEditor
            key={selected?.id ?? "new"}
            initial={initial}
            name={selected?.name ?? ""}
            onSave={saveSportRulesAction.bind(null, selected?.id ?? null)}
            saveLabel={selected ? "Enregistrer" : "Créer le sport"}
            warning="Les tournois existants gardent leur copie des règles ; modifiez-les depuis l'onglet « Règles & accès » du tournoi."
          />
        </div>
      </Page>
    </>
  );
}
