export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { listEngineers } from "@/lib/support-db";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const engineers = await listEngineers(context.tenantSlug);

  // Shape consumed by /itsupport/manager + /itsupport/agent dashboards
  const data = engineers.map((e) => ({
    id: e.id,
    employeeId: e.employeeId,
    name: e.displayName,
    role: e.role,
    region: e.region,
    serviceAreas: e.serviceAreas,
    skills: e.skills,
    onDuty: e.onDuty,
    workload: e.currentLoad,
    maxLoad: e.maxLoad,
    performanceScore: e.performanceScore,
    lastAssignmentAt: e.lastAssignmentAt,
  }));

  return NextResponse.json({ data });
}
