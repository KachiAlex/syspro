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
  try {
    const ids = [...new Set(rows.map((r) => r.assignedOfficerId).filter(Boolean))] as string[];
    if (ids.length === 0) return rows;
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(",");
    const res = await db.query(
      `select id, name from admin_employees where tenant_slug = $1 and id in (${placeholders})`,
      [tenantSlug, ...ids]
    );
    const names = new Map<string, string>(res.rows.map((r: any) => [r.id, r.name]));
    for (const row of rows) {
      (row as any).assignedOfficerName = names.get(row.assignedOfficerId) ?? null;
    }
  } catch {
    // name resolution is best-effort
  }
  return rows;
}
