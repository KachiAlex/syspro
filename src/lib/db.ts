import { neon } from "@neondatabase/serverless";

const globalForSql = globalThis as typeof globalThis & {
  neonSql?: ReturnType<typeof neon> | ((strings: TemplateStringsArray, ...args: any[]) => Promise<any>);
  usesMock?: boolean;
};

export function getSql() {
  const connectionString = process.env.DATABASE_URL;
  const isProduction = process.env.NODE_ENV === "production";

  // If DATABASE_URL is configured, always try to use real database
  if (connectionString) {
    if (!globalForSql.neonSql) {
      try {
        globalForSql.neonSql = neon(connectionString);
        console.log("✓ Connected to Neon database");
      } catch (err) {
        console.error("Failed to initialize Neon client:", err);
        // In production, fail loudly so the issue is visible immediately
        if (isProduction) {
          throw new Error(
            `DATABASE_URL is set but Neon client initialization failed in production. ` +
            `Error: ${err instanceof Error ? err.message : String(err)}`
          );
        }
        // Development fallback to mock
        globalForSql.neonSql = (async function mockSql(_strings: TemplateStringsArray, ..._args: any[]) {
          return [];
        }) as any;
        globalForSql.usesMock = true;
        console.warn("⚠ Falling back to mock SQL client (development only)");
      }
    }
    return globalForSql.neonSql as any;
  }

  // No DATABASE_URL configured
  if (isProduction) {
    throw new Error(
      `DATABASE_URL is not configured. ` +
      `The database connection string must be set in production.`
    );
  }

  // Development-only mock fallback
  if (!globalForSql.neonSql) {
    globalForSql.neonSql = (async function mockSql(_strings: TemplateStringsArray, ..._args: any[]) {
      return [];
    }) as any;
    globalForSql.usesMock = true;
    console.warn("⚠ DATABASE_URL not configured — using in-memory mock SQL client (dev only).");
  }

  return globalForSql.neonSql as any;
}
