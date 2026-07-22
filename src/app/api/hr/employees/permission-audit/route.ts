/**
 * Permission Audit Trail API
 * GET /api/hr/employees/permission-audit?tenantSlug=...
 * POST /api/hr/employees/permission-audit  (log a change)
 *
 * Stores audit entries in admin_audit_trail table.
 */

import { NextRequest, NextResponse } from "next/server";
import { sql as SQL } from "@/lib/sql-client";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug");
  const limit = parseInt(url.searchParams.get("limit") || "50", 10);
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  try {
    const rows = await SQL`
      SELECT id, actor_id, actor_name, action, target_id, target_name,
             old_value, new_value, created_at
      FROM admin_permission_audit
      WHERE tenant_slug = ${tenantSlug}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return NextResponse.json({ auditEntries: rows });
  } catch (error: any) {
    // Table might not exist yet — return empty
    console.error("permission-audit GET error:", error?.message);
    return NextResponse.json({ auditEntries: [] });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || !body.tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  const { tenantSlug, actorId, actorName, action, targetId, targetName, oldValue, newValue } = body;

  try {
    // Ensure table exists
    await SQL`
      CREATE TABLE IF NOT EXISTS admin_permission_audit (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        tenant_slug TEXT NOT NULL,
        actor_id TEXT,
        actor_name TEXT,
        action TEXT NOT NULL,
        target_id TEXT,
        target_name TEXT,
        old_value JSONB,
        new_value JSONB,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    await SQL`
      INSERT INTO admin_permission_audit (tenant_slug, actor_id, actor_name, action, target_id, target_name, old_value, new_value)
      VALUES (${tenantSlug}, ${actorId || null}, ${actorName || null}, ${action}, ${targetId || null}, ${targetName || null},
              ${oldValue ? JSON.stringify(oldValue) : null}::jsonb, ${newValue ? JSON.stringify(newValue) : null}::jsonb)
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("permission-audit POST error:", error?.message);
    return NextResponse.json({ error: "Failed to log audit entry" }, { status: 500 });
  }
}
