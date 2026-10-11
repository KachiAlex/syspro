import { db } from "@/lib/sql-client";

/**
 * Batch-resolves admin_employees names for assigned_officer_id values and
 * attaches `assignedOfficerName` to each row in place. Never throws — rows
 * keep a null name if resolution fails.
 */
export async function attachOfficerNames<T extends Record<string, any>>(
  tenantSlug: string,
  rows: T[]
): Promise<T[]> {
  await attachEmployeeNames(tenantSlug, rows, "assignedOfficerId", "assignedOfficerName");
  return rows;
}

/**
 * Generic: batch-resolves admin_employees names for an arbitrary id field on
 * each row and attaches the resolved name under `nameField`. Never throws.
 */
export async function attachEmployeeNames<T extends Record<string, any>>(
  tenantSlug: string,
  rows: T[],
  idField: string,
  nameField: string
): Promise<T[]> {
  try {
    const ids = [...new Set(rows.map((r) => r[idField]).filter(Boolean))] as string[];
    if (ids.length === 0) return rows;
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(",");
    const res = await db.query(
      `select id, name from admin_employees where tenant_slug = $1 and id in (${placeholders})`,
      [tenantSlug, ...ids]
    );
    const names = new Map<string, string>(res.rows.map((r: any) => [r.id, r.name]));
    for (const row of rows) {
      (row as any)[nameField] = names.get(row[idField]) ?? null;
    }
  } catch {
    // best-effort name resolution
  }
  return rows;
}
