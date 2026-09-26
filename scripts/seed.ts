// npm run seed : crée les tournois de démonstration
import { db } from "../lib/server/db";
import { createDemo } from "../lib/server/demo";

createDemo()
  .then(async (list) => {
    for (const b of list) console.log(`✔ ${b.tournament.name} → /t/${b.tournament.slug}`);
    for (const b of list)
      console.log(`  Codes arbitres ${b.tournament.name} : ${b.courtCodes.map((c, i) => `${b.courts[i].name} = ${c.code}`).join(", ")}`);
    await db().end();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
