// npm run db:migrate : crée la base SQLite (DATA_DIR/matchzy.db) si besoin, applique le schéma
// et ajoute les préréglages de sports (idempotent). L'application le fait aussi à son démarrage.
import path from "node:path";
import { dataDir, db } from "../lib/server/db";

async function main() {
  const sql = db();
  const [{ n }] = await sql<{ n: number }[]>`select count(*) as n from sports`;
  console.log(`✔ Base à jour (${path.join(dataDir(), "matchzy.db")}), ${n} sports.`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
