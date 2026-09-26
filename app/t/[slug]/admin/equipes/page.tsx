import { TeamsAdmin } from "@/components/TeamsAdmin";
import { Page } from "@/components/TopBar";
import { bundleOr404 } from "@/lib/server/page";

export const dynamic = "force-dynamic";

export default async function TeamsPage({ params }: { params: Promise<{ slug: string }> }) {
  const b = await bundleOr404((await params).slug);
  const pools = new Map(b.pools.map((p) => [p.id, p.name]));
  return (
    <Page>
      <p className="max-w-2xl text-sm leading-relaxed text-ink-2">
        Un abandon fait perdre par forfait tous les matchs non joués de l&apos;équipe (score par défaut du sport) ; elle est classée dernière de sa poule. Les pénalités
        fair-play servent de critère de départage si ce critère est activé.
      </p>
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
