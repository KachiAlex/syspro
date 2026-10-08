export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";

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
  const _gate1 = await requireModuleGate(request, "revops", "read");
  if (_gate1) return _gate1;
  const { searchParams } = new URL(request.url);
  const tenantSlug = context.tenantSlug;
  try {
    const leadSources = await listLeadSources(tenantSlug, buildFilters(searchParams));
    return NextResponse.json({ leadSources });
  } catch (error) {
    console.error("Failed to list lead sources", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to list lead sources" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const _gate2 = await requireModuleGate(request, "revops", "write");
  if (_gate2) return _gate2;
  const body = await request.json().catch(() => ({}));
  const requiredFields = [
    "name",
    "channel",
    "region",
    "subsidiary",
    "costCenter",
  ];
  const missing = requiredFields.find((field) => !body[field]);
  if (missing) {
    return NextResponse.json({ error: `Missing field: ${missing}` }, { status: 400 });
  }

  try {
    const leadSource = await createLeadSource({
      tenantSlug: context.tenantSlug,
      name: String(body.name),
      channel: body.channel as DemandChannel,
      region: String(body.region),
      branch: body.branch ? String(body.branch) : undefined,
      subsidiary: String(body.subsidiary),
      costCenter: String(body.costCenter),
      campaignId: body.campaignId ? String(body.campaignId) : undefined,
      createdBy: context.userId && context.userId !== "unknown" ? context.userId : String(body.createdBy ?? "system"),
    });

    return NextResponse.json({ leadSource }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create lead source";
    if (message === "Campaign not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("Failed to create lead source", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
