import { PlanningEditor, type PlanItem } from "@/components/PlanningEditor";
import { Page } from "@/components/TopBar";
import { bundleOr404 } from "@/lib/server/page";
import { View } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function PlanningPage({ params }: { params: Promise<{ slug: string }> }) {
  const b = await bundleOr404((await params).slug);
  const v = new View(b);
  const items: PlanItem[] = v.playable().map((m) => ({
    id: m.id,
    label: m.label ?? "",
    home: v.home(m),
    away: v.away(m),
    homeId: m.home_team_id,
    awayId: m.away_team_id,
    courtId: m.court_id,
    scheduledAt: m.scheduled_at,
    status: m.status,
  }));
  return (
    <Page>
      <PlanningEditor
        items={items}
        courts={b.courts.map((c) => ({ id: c.id, name: c.name }))}
        timezone={b.tournament.timezone}
        matchDuration={b.tournament.match_duration}
        courtLabel={b.tournament.rules.labels.court}
      />
    </Page>
  );
}
