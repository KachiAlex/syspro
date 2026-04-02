import { neon } from "@neondatabase/serverless";

const globalForSql = globalThis as typeof globalThis & {
  neonSql?: ReturnType<typeof neon> | ((strings: TemplateStringsArray, ...args: any[]) => Promise<any>);
  usesMock?: boolean;
};

export function getSql() {
  const connectionString = process.env.DATABASE_URL;
  
  // If DATABASE_URL is configured, always try to use real database
  if (connectionString) {
    if (!globalForSql.neonSql) {
      try {
        globalForSql.neonSql = neon(connectionString);
        console.log("✓ Connected to Neon database");
      } catch (err) {
        console.error("Failed to initialize Neon client:", err);
        // Fallback to mock if connection fails
        globalForSql.neonSql = (async function mockSql(_strings: TemplateStringsArray, ..._args: any[]) {
          return [];
        }) as any;
        globalForSql.usesMock = true;
        console.warn("⚠ Falling back to mock SQL client");
      }
    }
    return globalForSql.neonSql as any;
  }

  // No DATABASE_URL configured - use mock
  if (!globalForSql.neonSql) {
    globalForSql.neonSql = (async function mockSql(_strings: TemplateStringsArray, ..._args: any[]) {
      return [];
    }) as any;
    globalForSql.usesMock = true;
    console.warn("⚠ DATABASE_URL not configured — using in-memory mock SQL client (dev only).");
  }

  return globalForSql.neonSql as any;
}
