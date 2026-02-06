import { NextRequest, NextResponse } from "next/server";

import { createIncident, listIncidents } from "@/lib/support-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug") || "default";
  const incidents = listIncidents(tenantSlug);
  return NextResponse.json({ incidents });
}

export async function POST(request: NextRequest) {
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

  const tenantSlug = body.tenantSlug || "default";
  const incident = createIncident({
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
