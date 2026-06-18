import { NextRequest, NextResponse } from "next/server";

import { createIncident, listIncidents } from "@/lib/support-db";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const { searchParams } = new URL(request.url);
  const tenantSlug = context.tenantSlug;
  const incidents = await listIncidents(tenantSlug);
  return NextResponse.json({ incidents });
}

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const body = (await request.json()) as {
    tenantSlug?: string;
    sourceSystem?: string;
    incidentType?: string;
    severity?: "critical" | "high" | "medium" | "low";
    summary?: string;
    affectedServices?: string[];
    region?: string;
    branchId?: string;
    linkedTicketId?: string;
  };

  if (!body.sourceSystem || !body.severity) {
    return NextResponse.json({ error: "sourceSystem and severity are required" }, { status: 400 });
  }

  const tenantSlug = context.tenantSlug;
  const incident = await createIncident({
    tenantSlug,
    sourceSystem: body.sourceSystem,
    incidentType: body.incidentType,
    severity: body.severity,
    summary: body.summary,
    affectedServices: body.affectedServices,
    region: body.region,
    branchId: body.branchId,
    linkedTicketId: body.linkedTicketId,
  });

  return NextResponse.json({ incident }, { status: 201 });
}
