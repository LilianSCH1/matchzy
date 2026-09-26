// npm run db:migrate : crée / met à jour le schéma et les préréglages de sports (idempotent).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../lib/server/db";
import { SPORT_PRESETS } from "../lib/sports";

async function main() {
  const sql = db();
  await sql.unsafe(readFileSync(join(__dirname, "..", "db", "schema.sql"), "utf8"));
  for (const p of SPORT_PRESETS) {
    // Les préréglages déjà présents ne sont pas écrasés (ils ont pu être modifiés dans l'application).
    await sql`insert into sports (slug, name, rules, is_preset) values (${p.slug}, ${p.name}, ${sql.json(p.rules as never)}, true)
              on conflict (slug) do nothing`;
  }
  const [{ n }] = await sql`select count(*)::int as n from sports`;
  console.log(`✔ Schéma à jour, ${n} sports en base.`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
