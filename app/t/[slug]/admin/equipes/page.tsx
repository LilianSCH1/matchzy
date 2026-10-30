import { TeamsAdmin } from "@/components/TeamsAdmin";
import { Page, PageHeader } from "@/components/TopBar";
import { bundleOr404 } from "@/lib/server/page";

export const dynamic = "force-dynamic";

export default async function TeamsPage({ params }: { params: Promise<{ slug: string }> }) {
  const b = await bundleOr404((await params).slug);
  const pools = new Map(b.pools.map((p) => [p.id, p.name]));
  return (
    <Page wide>
      <PageHeader
        title="Équipes"
        description="Renommez une équipe avec le crayon. « Abandon » donne perdus par forfait tous ses matchs restants."
      />
      <TeamsAdmin
        teams={b.teams.map((t) => ({
          id: t.id,
          name: t.name,
          pool: t.pool_id ? (pools.get(t.pool_id) ?? null) : null,
          withdrawn: t.withdrawn,
          fairPlay: t.fair_play,
        }))}
      />
    </Page>
  );
}
