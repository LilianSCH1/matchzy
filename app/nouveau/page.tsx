import { TournamentWizard } from "@/components/TournamentWizard";
import { TopBar } from "@/components/TopBar";
import { listSports } from "@/lib/server/data";
import { requireOrganizerPage } from "@/lib/server/page";

export const dynamic = "force-dynamic";

export default async function NewTournamentPage() {
  await requireOrganizerPage("/nouveau");
  const sports = await listSports();
  return (
    <>
      <TopBar title="Nouveau tournoi" back="/" />
      <main className="mx-auto max-w-3xl px-4 pt-6 sm:px-5">
        <TournamentWizard sports={sports} />
      </main>
    </>
  );
}
