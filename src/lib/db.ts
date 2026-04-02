import { neon } from "@neondatabase/serverless";

const globalForSql = globalThis as typeof globalThis & {
  neonSql?: ReturnType<typeof neon> | ((strings: TemplateStringsArray, ...args: any[]) => Promise<any>);
  usesMock?: boolean;
};

export function getSql() {
  const connectionString = process.env.DATABASE_URL;
  
  // Always use mock in development to avoid connection failures
  // This allows UI development without database connectivity
  if (process.env.NODE_ENV === 'development' || !connectionString) {
    if (!globalForSql.neonSql) {
      // Create a minimal mock that can be used as a template tag: `await sql`...``
      globalForSql.neonSql = (async function mockSql(_strings: TemplateStringsArray, ..._args: any[]) {
        return [];
      }) as any;
      globalForSql.usesMock = true;
    }
    if (globalForSql.usesMock) {
      console.warn("Using in-memory mock SQL client (dev mode) — database calls will return empty results.");
    }
    return globalForSql.neonSql as any;
  }

  if (!globalForSql.neonSql) {
    try {
      globalForSql.neonSql = neon(connectionString);
    } catch (err) {
      console.warn("Failed to initialize Neon client, falling back to mock:", err);
      globalForSql.neonSql = (async function mockSql(_strings: TemplateStringsArray, ..._args: any[]) {
        return [];
      }) as any;
      globalForSql.usesMock = true;
    }
  }

  return globalForSql.neonSql as any;
}
