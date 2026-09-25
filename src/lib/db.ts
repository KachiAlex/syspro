import { Pool, QueryResult } from "pg";

type SqlTemplateFn = ((
  strings: TemplateStringsArray,
  ...args: any[]
) => Promise<any[]>) & {
  query: (text: string, params?: any[]) => Promise<QueryResult>;
  join: (parts: any[], sep?: string) => string;
  readonly END: unique symbol;
};

const globalForSql = globalThis as typeof globalThis & {
  pgPool?: Pool;
  sqlClient?: SqlTemplateFn;
};

function buildSqlTemplateFn(pool: Pool): SqlTemplateFn {
  const fn = async function sql(
    strings: TemplateStringsArray,
    ...args: any[]
  ): Promise<any[]> {
    let text = "";
    const values: any[] = [];

    for (let i = 0; i < strings.length; i++) {
      text += strings[i];
      if (i < args.length) {
        const arg = args[i];
        if (arg && typeof arg === "object" && "toSQL" in arg && typeof arg.toSQL === "function") {
          const inner = arg.toSQL();
          const offset = values.length;
          text += inner.text.replace(/\$(\d+)/g, (_m: string, p1: string) => `$${Number(p1) + offset}`);
          values.push(...inner.values);
        } else if (arg && typeof arg === "object" && "text" in arg && "values" in arg) {
          const offset = values.length;
          text += arg.text.replace(/\$(\d+)/g, (_m: string, p1: string) => `$${Number(p1) + offset}`);
          values.push(...arg.values);
        } else {
          values.push(arg);
          text += `$${values.length}`;
        }
      }
    }

    const result = await pool.query(text, values);
    return result.rows;
  } as SqlTemplateFn;

  fn.query = async function query(text: string, params?: any[]): Promise<QueryResult> {
    return pool.query(text, params || []);
  };

  fn.join = function join(parts: any[], sep = ","): string {
    return parts
      .map((p: any) => {
        if (p && typeof p === "object" && "toSQL" in p && typeof p.toSQL === "function") {
          const inner = p.toSQL();
          return inner.text;
        }
        if (p && typeof p === "object" && "text" in p) {
          return p.text;
        }
        return String(p);
      })
      .join(sep);
  };

  return fn;
}

export function getSql(): SqlTemplateFn {
  const connectionString = process.env.DATABASE_URL;
  const isProduction = process.env.NODE_ENV === "production";

  if (connectionString) {
    if (!globalForSql.pgPool) {
      try {
        globalForSql.pgPool = new Pool({
          connectionString,
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
        });
        globalForSql.sqlClient = buildSqlTemplateFn(globalForSql.pgPool);
        console.log("Connected to Postgres database");
      } catch (err) {
        console.error("Failed to initialize Postgres client:", err);
        if (isProduction) {
          throw new Error(
            `DATABASE_URL is set but Postgres client initialization failed in production. ` +
            `Error: ${err instanceof Error ? err.message : String(err)}`
          );
        }
        globalForSql.sqlClient = Object.assign(
          async function mockSql() {
            return [];
          },
          {
            query: async () => ({ rows: [], rowCount: 0, command: "", oid: 0, fields: [], rowAsArray: false }),
            join: () => "",
          }
        ) as any;
        console.warn("Falling back to mock SQL client (development only)");
      }
    }
    return globalForSql.sqlClient!;
  }

  if (isProduction) {
    throw new Error(
      `DATABASE_URL is not configured. ` +
      `The database connection string must be set in production.`
    );
  }

  if (!globalForSql.sqlClient) {
    globalForSql.sqlClient = Object.assign(
      async function mockSql() {
        return [];
      },
      {
        query: async () => ({ rows: [], rowCount: 0, command: "", oid: 0, fields: [], rowAsArray: false }),
        join: () => "",
      }
    ) as any;
    console.warn("DATABASE_URL not configured — using in-memory mock SQL client (dev only).");
  }

  return globalForSql.sqlClient!;
}
