import { getSql } from "./db";

/**
 * Minimal SQL executor: a tagged-template function returning rows.
 * Both the `sql` export below and `getSql()`'s richer SqlTemplateFn
 * (which adds .query/.join/.END) satisfy this — callers must only use
 * the template-tag form.
 */
export type SqlClient = <T = any>(
  strings: TemplateStringsArray,
  ...args: any[]
) => Promise<T[]>;

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
    const rows = await (client as any)(strings, ...args);
    return db.mapRows(rows) as unknown as T;
  },

  async query<T = any>(queryText: string, params?: any[]) {
    const client = getSql();
    const res = await (client as any).query(queryText, params || []);
    const rows = (res.rows ?? []) as T[];
    const rowCount = res.rowCount ?? rows.length;
    return { rows, rowCount, count: rowCount, raw: res } as QueryResult<T>;
  },

  async join(parts: any[] | Promise<any[]>, sep = ",") {
    const resolvedParts = Array.isArray(parts) ? parts : await parts;
    const client = getSql();
    if (typeof (client as any).join === "function") {
      return (client as any).join(resolvedParts, sep);
    }
    const flat = resolvedParts.map((p: any) => {
      if (p && typeof p === "object" && typeof p.toSQL === "function") {
        return p.toSQL().text;
      }
      if (p && typeof p === "object" && "text" in p) {
        return p.text;
      }
      return Array.isArray(p) ? p.join(sep) : String(p);
    });
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
    const client = getSql();
    const execPromise = (client as any).query
      ? (client as any).query(text, values).then((res: any) => res.rows)
      : (client as any)(this.strings, ...this.args);

    return Promise.resolve(execPromise)
      .then((rows: any) => {
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
