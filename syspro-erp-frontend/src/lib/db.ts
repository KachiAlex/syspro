import { neon } from "@neondatabase/serverless";

const globalForSql = globalThis as typeof globalThis & {
  neonSql?: ReturnType<typeof neon>;
};

export function getSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured. Set it in your Vercel/ENV settings to enable database access.");
  }

  if (!globalForSql.neonSql) {
    globalForSql.neonSql = neon(connectionString);
  }

  return globalForSql.neonSql;
}
