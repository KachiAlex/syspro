import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

import { createLeadSource, listLeadSources, type DemandChannel, type LeadSourceFilters } from "@/lib/revops-data";

function buildFilters(searchParams: URLSearchParams): LeadSourceFilters {
  const filters: LeadSourceFilters = {};
  const channel = searchParams.get("channel") as DemandChannel | null;
  const region = searchParams.get("region");
  const status = searchParams.get("status") as LeadSourceFilters["status"] | null;

  if (channel) filters.channel = channel;
  if (region) filters.region = region;
  if (status) filters.status = status;
  return filters;
}

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const { searchParams } = new URL(request.url);
  const tenantSlug = context.tenantSlug;
  const leadSources = listLeadSources(tenantSlug, buildFilters(searchParams));
  return NextResponse.json({ leadSources });
}

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const body = await request.json().catch(() => ({}));
  const requiredFields = [
    "name",
    "channel",
    "region",
    "subsidiary",
    "costCenter",
    "createdBy",
  ];
  const missing = requiredFields.find((field) => !body[field]);
  if (missing) {
    return NextResponse.json({ error: `Missing field: ${missing}` }, { status: 400 });
  }

  try {
    const leadSource = createLeadSource({
      tenantSlug: context.tenantSlug,
      name: String(body.name),
      channel: body.channel as DemandChannel,
      region: String(body.region),
      branch: body.branch ? String(body.branch) : undefined,
      subsidiary: String(body.subsidiary),
      costCenter: String(body.costCenter),
      campaignId: body.campaignId ? String(body.campaignId) : undefined,
      createdBy: String(body.createdBy),
    });

    return NextResponse.json({ leadSource }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create lead source" }, { status: 500 });
  }
}
