import postgres from "postgres";

// Une seule connexion par processus (évite d'épuiser le pool pendant le rechargement à chaud en dev).
const globalForDb = globalThis as unknown as { __sql?: postgres.Sql };

export function isConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}

/** Client PostgreSQL (Neon ou tout autre Postgres). Uniquement côté serveur. */
export function db(): postgres.Sql {
  if (!globalForDb.__sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL manquant (voir .env.example).");
    globalForDb.__sql = postgres(url, {
      max: 5,
      // Compatible avec le pooler de Neon (PgBouncer en mode transaction)
      prepare: false,
      connection: { TimeZone: "UTC" },
      types: {
        // Horodatages renvoyés en chaîne ISO, dates en « AAAA-MM-JJ » (comme le reste de l'application)
        timestamptz: {
          to: 1184,
          from: [1184, 1114],
          serialize: (x: string | Date) => (x instanceof Date ? x.toISOString() : x),
          parse: (x: string) => new Date(x).toISOString(),
        },
        date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
      },
      onnotice: () => {},
    });
  }
  return globalForDb.__sql;
}

/** Client utilisable hors transaction ou dans une transaction. */
export type Q = postgres.ISql;

/**
 * Exécute `fn` dans une transaction qui détient le verrou du tournoi : les écritures
 * et recalculs d'un même tournoi sont sérialisés (deux terrains qui valident en même temps).
 */
export function withTournamentLock<T>(tournamentId: string, fn: (sql: postgres.TransactionSql) => Promise<T>): Promise<T> {
  return db().begin(async (sql) => {
    await sql`select pg_advisory_xact_lock(hashtext(${tournamentId}))`;
    return fn(sql);
  }) as Promise<T>;
}
