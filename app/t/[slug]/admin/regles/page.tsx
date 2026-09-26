import { updateTournamentRulesAction } from "@/app/actions";
import { CourtsAdmin } from "@/components/CourtsAdmin";
import { DeleteTournamentButton } from "@/components/TournamentActions";
import { RulesEditor } from "@/components/RulesEditor";
import { Page, Section } from "@/components/TopBar";
import { courtCodes } from "@/lib/server/data";
import { bundleOr404 } from "@/lib/server/page";
import { fmtTime, FORMAT_LABEL } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function RulesPage({ params }: { params: Promise<{ slug: string }> }) {
  const b = await bundleOr404((await params).slug);
  const t = b.tournament;
  const codes = await courtCodes(t.id);
  return (
    <Page>
      <Section title={`${t.rules.labels.courtPlural[0].toUpperCase()}${t.rules.labels.courtPlural.slice(1)} et codes arbitres`}>
        <CourtsAdmin courts={b.courts.map((c) => ({ id: c.id, name: c.name, code: codes.get(c.id) ?? "?" }))} refereeUrl={`/t/${t.slug}/arbitre`} />
      </Section>

      <Section title="Configuration">
        <div className="card grid grid-cols-2 gap-x-4 gap-y-5 p-5 sm:grid-cols-4">
          <Info label="Sport" value={t.sport_name} />
          <Info label="Format" value={FORMAT_LABEL[t.format]} />
          <Info label="Début" value={fmtTime(t.start_at, t.timezone)} />
          <Info label="Match / pause" value={`${t.match_duration} / ${t.break_duration} min`} />
          {t.format === "pools_knockout" && (
            <Info label="Qualifiés" value={`${t.qualifiers_per_pool} par poule${t.best_extra ? ` + ${t.best_extra} meilleur(s) ${t.qualifiers_per_pool + 1}e` : ""}`} />
          )}
          <Info label="Repos minimum" value={`${t.min_rest} min`} />
          {t.format !== "pools" && <Info label="Petite finale" value={t.third_place ? "Oui" : "Non"} />}
        </div>
      </Section>

      <Section title="Règles du sport pour ce tournoi">
        <RulesEditor
          initial={t.rules}
          onSave={updateTournamentRulesAction.bind(null, t.id)}
          warning="Les classements et le tableau sont recalculés immédiatement. Évitez de changer le type de score une fois des matchs joués."
        />
      </Section>

      <Section title="Zone dangereuse">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-danger/30 p-5">
          <p className="text-sm text-ink-2">Supprime définitivement le tournoi, ses équipes, matchs et résultats.</p>
          <DeleteTournamentButton id={t.id} name={t.name} redirectTo="/" />
        </div>
      </Section>
    </Page>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}
