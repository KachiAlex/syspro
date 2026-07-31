import { NextResponse } from 'next/server';
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { listEmployees } from "@/lib/hr/db";

function toReportingLevel(role: string | null | undefined): 'staff' | 'admin' | 'superadmin' {
  if (role === 'admin' || role === 'executive') return 'admin';
  if (role === 'hod') return 'admin';
  return 'staff';
}

// Real recipient list for report submission/creation — sourced directly
// from tenant employees, no mock/placeholder data.
export async function GET(request: Request) {
  try {
    const context = validateTenantContext(request as any, "read");
    const employees = await listEmployees({ tenantSlug: context.tenantSlug, status: "active", limit: 500 });

    const recipients = employees.map((e) => ({
      id: e.id,
      name: e.name,
      role: e.jobTitle || e.role || "Staff",
      level: toReportingLevel(e.role),
    }));

    return NextResponse.json({ recipients });
  } catch (error) {
    console.error('Failed to fetch report recipients:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch recipients';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
