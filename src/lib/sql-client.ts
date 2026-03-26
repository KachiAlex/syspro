import { getSql } from "./db";

export type SqlClient = ReturnType<typeof getSql>;

export type QueryResult<T> = { rows: T[]; rowCount: number; count: number; raw?: any };

function toCamel(s: string) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function mapRowKeys<T extends Record<string, any>>(row: T): Record<string, any> {
  if (!row || typeof row !== "object") return row as any;
  const out: Record<string, any> = {};
  for (const k of Object.keys(row)) {
    out[toCamel(k)] = row[k];
  }
  return out;
}

export interface DbClient {
  sql: <T = any>(strings: TemplateStringsArray, ...args: any[]) => Promise<T>;
  query: <T = any>(queryText: string, params?: any[]) => Promise<QueryResult<T>>;
  join: (parts: any[] | Promise<any[]>, sep?: string) => Promise<string> | string;
  mapRow: <T = any>(row: T) => any;
  mapRows: <T = any>(rows: T[]) => any[];
}

export const db: DbClient = {
  async sql<T = any>(strings: TemplateStringsArray, ...args: any[]) {
    const client = getSql();
    const res = await (client as any)(strings, ...args);

    if (Array.isArray(res)) {
      return db.mapRows(res) as unknown as T;
    }

    if (res && typeof res === "object") {
      const rows = Array.isArray(res.rows) ? db.mapRows(res.rows) : res.rows;
      if (res.rows) return { ...res, rows } as unknown as T;
      return res as T;
    }

    return [] as unknown as T;
  },

  async query<T = any>(queryText: string, params?: any[]) {
    const client = getSql();
    let res: any;
    if ((client as any).query) {
      res = await (client as any).query(queryText, params);
    } else {
      // Convert a pg-style text with $1,$2 placeholders into a template
      // strings array for template-tag clients (e.g. neon). This lets us
      // support callers that use `db.query(text, params)` while still
      // supporting template-tag DB clients.
      const values = params || [];
      const parts: string[] = [];
      const re = /\$(\d+)/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = re.exec(queryText)) !== null) {
        const idx = match.index;
        parts.push(queryText.slice(lastIndex, idx));
        lastIndex = idx + match[0].length;
      }
      parts.push(queryText.slice(lastIndex));

      const strings = parts as unknown as TemplateStringsArray;
      res = await (client as any)(strings, ...values);
    }

    if (Array.isArray(res)) {
      const rows = res as T[];
      return { rows, rowCount: rows.length, count: rows.length } as QueryResult<T>;
    }

    if (res && typeof res === "object") {
      const rows = (res.rows ?? res) as T[];
      const rowCount = res.rowCount ?? res.count ?? (Array.isArray(rows) ? rows.length : 0);
      return { rows, rowCount, count: rowCount, raw: res } as QueryResult<T>;
    }

    return { rows: [] as T[], rowCount: 0, count: 0 } as QueryResult<T>;
  },

  async join(parts: any[] | Promise<any[]>, sep = ",") {
    const resolvedParts = Array.isArray(parts) ? parts : await parts;
    const client = getSql();
    if ((client as any).join) return (client as any).join(resolvedParts, sep);
    const flat = resolvedParts.map((p: any) => (Array.isArray(p) ? p.join(sep) : String(p)));
    return flat.join(sep);
  },

  mapRow(row: any) {
    return mapRowKeys(row);
  },

  mapRows(rows: any[]) {
    if (!Array.isArray(rows)) return rows;
    return rows.map((r) => mapRowKeys(r));
  },
};

class SQLFragment {
  strings: TemplateStringsArray;
  args: any[];
  constructor(strings: TemplateStringsArray, args: any[]) {
    this.strings = strings;
    this.args = args;
  }

  toSQL() {
    let text = "";
    const values: any[] = [];

    for (let i = 0; i < this.strings.length; i++) {
      text += this.strings[i];
      if (i < this.args.length) {
        const a = this.args[i];
        if (a instanceof SQLFragment) {
          const inner = a.toSQL();
          const offset = values.length;
          const remapped = inner.text.replace(/\$(\d+)/g, (_m, p1) => `$${Number(p1) + offset}`);
          text += remapped;
          values.push(...inner.values);
        } else {
          values.push(a);
          text += `$${values.length}`;
        }
      }
    }

    return { text, values };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ) {
    const { text, values } = this.toSQL();
    // Execute against the underlying client directly to support both
    // pg-style clients with `.query(text, params)` and template-tag
    // style clients (e.g. neon) which expect the original template
    // strings and interpolated args.
    const client = getSql();
    const execPromise = (client as any).query
      ? (client as any).query(text, values)
      : (client as any)(this.strings, ...this.args);

    return Promise.resolve(execPromise)
      .then((res: any) => {
        // Normalize to rows for the caller
        const rows = Array.isArray(res) ? res : res?.rows ?? res;
        return onfulfilled ? onfulfilled(rows) : rows;
      })
      .catch(onrejected as any);
  }
}

function buildFragment(strings: TemplateStringsArray, ...args: any[]) {
  return new SQLFragment(strings, args);
}

const SQL = Object.assign(
  (strings: TemplateStringsArray, ...args: any[]) => buildFragment(strings, ...args),
  {
    join: (parts: any[] | Promise<any[]>, sep = ",") => db.join(parts, sep),
    mapRows: db.mapRows.bind(db),
  }
);

export const sql = SQL as unknown as (<T = any>(strings: TemplateStringsArray, ...args: any[]) => Promise<T[]>) & {
  join: (parts: any[] | Promise<any[]>, sep?: string) => Promise<string> | string;
  mapRows: <T = any>(rows: T[]) => any[];
};
