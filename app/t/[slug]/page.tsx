import { Bracket } from "@/components/Bracket";
import { IconBolt, IconBracket, IconCalendar, IconList, IconScreen } from "@/components/Icons";
import { LiveRefresh } from "@/components/LiveRefresh";
import { MatchRow } from "@/components/MatchRow";
import { Standings } from "@/components/Standings";
import { TeamFilter } from "@/components/TeamFilter";
import { Empty, Page, Section, TabBar, TopBar, TopLink } from "@/components/TopBar";
import { bundleOr404 } from "@/lib/server/page";
import { byTime, fmtDate, View } from "@/lib/view";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ v?: string; equipe?: string }> };

export async function generateMetadata({ params }: Params) {
  const b = await bundleOr404((await params).slug);
  return { title: `${b.tournament.name} — Matchzy` };
}

export default async function PublicPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const { v: tab = "direct", equipe } = await searchParams;
  const b = await bundleOr404(slug);
  const v = new View(b);
  const t = b.tournament;
  const base = `/t/${t.slug}`;
  const ic = "size-4";
  const tabs = [
    { key: "direct", label: "En direct", href: base, icon: <IconBolt className={ic} /> },
    ...(t.format !== "knockout" ? [{ key: "classements", label: "Classements", href: `${base}?v=classements`, icon: <IconList className={ic} /> }] : []),
    ...(t.format !== "pools" ? [{ key: "tableau", label: "Phase finale", href: `${base}?v=tableau`, icon: <IconBracket className={ic} /> }] : []),
    { key: "programme", label: "Programme", href: `${base}?v=programme`, icon: <IconCalendar className={ic} /> },
  ];

  return (
    <>
      <LiveRefresh />
      <TopBar title={t.name} subtitle={`${t.sport_name} · ${fmtDate(t.date)}`} back="/" right={<TopLink href={`${base}/ecran`} icon={<IconScreen className="size-4" />} label="Écran géant" />} />
      <TabBar items={tabs} active={tab} />
      <Page>
        {tab === "direct" && <Live v={v} />}
        {tab === "classements" && <Standings v={v} />}
        {tab === "tableau" && <Bracket v={v} />}
        {tab === "programme" && <Programme v={v} team={equipe} base={base} />}
      </Page>
    </>
  );
}

function Live({ v }: { v: View }) {
  const live = v.live().sort(byTime);
  const next = v.nextByCourt(2);
  const recent = v
    .playable()
    .filter((m) => m.status === "finished")
    .sort((a, b) => (b.finished_at ?? "").localeCompare(a.finished_at ?? ""))
    .slice(0, 6);
  const L = v.b.tournament.rules.labels;
  return (
    <>
      <Section title="En cours">
        {live.length ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {live.map((m) => (
              <MatchRow key={m.id} m={m} v={v} />
            ))}
          </div>
        ) : (
          <Empty>Aucun match en cours pour le moment.</Empty>
        )}
      </Section>
      <Section title="À suivre" hint={`Les deux prochains matchs de chaque ${L.court}`}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {next.map(({ courtId, matches }) => (
            <div key={courtId} className="space-y-2">
              <div className="eyebrow">{v.courts.get(courtId)}</div>
              {matches.length ? matches.map((m) => <MatchRow key={m.id} m={m} v={v} showCourt={false} />) : <Empty>Plus de match prévu.</Empty>}
            </div>
          ))}
        </div>
      </Section>
      {recent.length > 0 && (
        <Section title="Derniers résultats">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {recent.map((m) => (
              <MatchRow key={m.id} m={m} v={v} />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function Programme({ v, team, base }: { v: View; team?: string; base: string }) {
  const list = v
    .playable()
    .filter((m) => !team || m.home_team_id === team || m.away_team_id === team)
    .sort(byTime);
  const teams = [...v.b.teams].sort((a, b) => a.name.localeCompare(b.name)).map((t) => ({ id: t.id, name: t.name }));
  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <TeamFilter base={base} teams={teams} value={team} />
      </div>
      <div className="space-y-2">{list.length ? list.map((m) => <MatchRow key={m.id} m={m} v={v} />) : <Empty>Aucun match.</Empty>}</div>
    </div>
  );
}
