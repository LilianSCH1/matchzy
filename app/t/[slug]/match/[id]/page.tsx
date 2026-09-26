import { notFound, redirect } from "next/navigation";
import { ScoreScreen } from "@/components/ScoreScreen";
import { TopBar } from "@/components/TopBar";
import { isOrganizer, refereeCourt } from "@/lib/server/auth";
import { bundleOr404 } from "@/lib/server/page";
import { fmtTime, View } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function MatchPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const b = await bundleOr404(slug);
  const m = b.matches.find((x) => x.id === id);
  if (!m) notFound();
  const t = b.tournament;
  const org = await isOrganizer();
  const court = await refereeCourt(t.id);
  if (!org && court !== m.court_id) redirect(`/t/${t.slug}/arbitre`);
  const v = new View(b);
  const back = org && !court ? `/t/${t.slug}/arbitre?terrain=${m.court_id}` : `/t/${t.slug}/arbitre`;
  return (
    <>
      <TopBar title={m.label ?? "Match"} subtitle={`${v.court(m)} · ${fmtTime(m.scheduled_at, t.timezone)}`} back={back} />
      <ScoreScreen
        key={`${m.id}-${m.status}-${m.home_team_id}-${m.away_team_id}`}
        match={m}
        rules={t.rules}
        homeName={v.home(m)}
        awayName={v.away(m)}
        isOrganizer={org}
        back={back}
      />
    </>
  );
}
