import postgres from "postgres";

const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL n'est pas défini");
  // prepare: false reste compatible avec les poolers en mode transaction (Supabase, Neon).
  return postgres(url, {
    prepare: false,
    max: 10,
    onnotice: () => {},
    types: { bigint: postgres.BigInt },
  });
}

export const sql = globalForDb.sql ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;
