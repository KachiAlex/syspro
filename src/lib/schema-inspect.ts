import { db } from "@/lib/sql-client";

export type ColumnInfo = { name: string; dataType: string };

// The schema differs across environments (uuid PK + code/domain/schemaName
// columns in dev-created DBs, serial integer PK without them in production).
// Inspecting information_schema keeps inserts working against either shape.
export async function getTableColumns(table: string): Promise<Map<string, ColumnInfo>> {
  const res = await db.query<{ column_name: string; data_type: string }>(
    "select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = $1",
    [table]
  );
  const map = new Map<string, ColumnInfo>();
  for (const r of res.rows) map.set(r.column_name, { name: r.column_name, dataType: r.data_type });
  return map;
}

// Column names always come from the caller's own literal keys, so quoting
// them here is safe — values are still parameterized.
export async function insertRow(
  table: string,
  values: Record<string, unknown>,
  returning = "id"
) {
  const cols = await getTableColumns(table);
  const entries = Object.entries(values).filter(([c]) => cols.has(c));
  if (entries.length === 0) throw new Error(`No writable columns found on ${table}`);
  const colList = entries.map(([c]) => `"${c}"`).join(", ");
  const placeholders = entries.map((_, i) => `$${i + 1}`).join(", ");
  const params = entries.map(([, v]) => v);
  const res = await db.query<any>(
    `insert into ${table} (${colList}) values (${placeholders}) returning "${returning}"`,
    params
  );
  return { row: res.rows[0], idType: cols.get(returning)?.dataType };
}
