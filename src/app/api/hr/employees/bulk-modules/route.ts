/**
 * Bulk Module Assignment API
 * POST /api/hr/employees/bulk-modules
 * Apply module permissions to multiple employees at once.
 *
 * Body: {
 *   tenantSlug: string,
 *   employeeIds: string[],
 *   modules: Record<string, boolean>,
 *   mode: "replace" | "merge"  (default: replace)
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { sql as SQL } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import { invalidatePrefix } from "@/lib/cache";

export const dynamic = 'force-dynamic';

const VALID_MODULES = [
  "self_service", "crm", "finance", "people", "projects",
  "sales", "analytics", "automation", "admin",
];

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || !body.tenantSlug || !body.employeeIds || !Array.isArray(body.employeeIds) || !body.modules) {
    return NextResponse.json({ error: "tenantSlug, employeeIds (array), and modules are required" }, { status: 400 });
  }

  const { tenantSlug, employeeIds, modules, mode = "replace" } = body as {
    tenantSlug: string;
    employeeIds: string[];
    modules: Record<string, boolean>;
    mode: "replace" | "merge";
  };

  if (employeeIds.length === 0) {
    return NextResponse.json({ error: "At least one employee must be selected" }, { status: 400 });
  }

  // Clean modules
  const cleaned: Record<string, boolean> = {};
  for (const mod of VALID_MODULES) {
    cleaned[mod] = modules[mod] === true;
  }
  cleaned.self_service = true; // always on

  try {
    await ensureHrTables(SQL);

    if (mode === "merge") {
      // Merge: fetch existing perms and merge
      for (const empId of employeeIds) {
        const rows = await SQL`
          SELECT portal_permissions FROM admin_employees
          WHERE id = ${empId} AND tenant_slug = ${tenantSlug}
          LIMIT 1
        `;
        const emp = (rows as any[])[0];
        const existing = (emp?.portal_permissions && typeof emp.portal_permissions === "object")
          ? emp.portal_permissions
          : {};
        const merged = { ...existing, ...cleaned };
        await SQL`
          UPDATE admin_employees
          SET portal_permissions = ${JSON.stringify(merged)}::jsonb, updated_at = now()
          WHERE id = ${empId} AND tenant_slug = ${tenantSlug}
        `;
        invalidatePrefix(`perms:${tenantSlug}:${empId}:`);
        invalidatePrefix(`empmods:${tenantSlug}:${empId}`);
      }
    } else {
      // Replace: set all to cleaned values
      for (const empId of employeeIds) {
        await SQL`
          UPDATE admin_employees
          SET portal_permissions = ${JSON.stringify(cleaned)}::jsonb, updated_at = now()
          WHERE id = ${empId} AND tenant_slug = ${tenantSlug}
        `;
        invalidatePrefix(`perms:${tenantSlug}:${empId}:`);
        invalidatePrefix(`empmods:${tenantSlug}:${empId}`);
      }
    }

    return NextResponse.json({
      success: true,
      updatedCount: employeeIds.length,
      modules: cleaned,
    });
  } catch (error: any) {
    console.error("bulk-modules POST error:", error?.message);
    return NextResponse.json({ error: "Failed to bulk update modules" }, { status: 500 });
  }
}
