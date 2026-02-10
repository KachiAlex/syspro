import { neon } from "@neondatabase/serverless";

const globalForSql = globalThis as typeof globalThis & {
  neonSql?: ReturnType<typeof neon> | ((strings: TemplateStringsArray, ...args: any[]) => Promise<any>);
};

export function getSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // In development environments we provide a lightweight mock SQL tag
    // so server routes that reference `getSql()` won't crash with a thrown
    // error when no DATABASE_URL is configured. This prevents widespread
    // 500 responses while developing UI features that don't need a real DB.
    if (!globalForSql.neonSql) {
      // Create a minimal mock that can be used as a template tag: `await sql`...``
      globalForSql.neonSql = (async function mockSql(_strings: TemplateStringsArray, ..._args: any[]) {
        return [];
      }) as any;
    }
    console.warn("DATABASE_URL is not configured — using in-memory mock SQL client (dev only).");
    return globalForSql.neonSql as any;
  }

  if (!globalForSql.neonSql) {
    globalForSql.neonSql = neon(connectionString);
  }

  return globalForSql.neonSql as any;
}
