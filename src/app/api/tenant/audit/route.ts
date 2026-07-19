import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";

export async function GET(request: NextRequest) {
  const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  try {
    const rows = await sql`
      select id, action, user_id, resource, resource_id, changes, created_at
      from admin_audit_logs
      where tenant_slug = ${tenantSlug}
      order by created_at desc
      limit 100
    `;

    const logs = (Array.isArray(rows) ? rows : []).map((row: any) => ({
      id: row.id,
      action: row.action,
      user: row.user_id || "system",
      resource: row.resource,
      timestamp: row.created_at?.toISOString?.() ?? row.created_at,
      details: row.changes ? JSON.stringify(row.changes) : undefined,
    }));

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Failed to fetch tenant audit logs:", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
