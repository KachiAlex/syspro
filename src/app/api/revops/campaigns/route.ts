export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";

import {
  createCampaign,
  deleteCampaign,
  listCampaigns,
  updateCampaign,
  type CampaignFilters,
  type CampaignStatus,
  type DemandChannel,
} from "@/lib/revops-data";

function buildFilters(searchParams: URLSearchParams): CampaignFilters {
  const filters: CampaignFilters = {};
  const status = searchParams.get("status");
  const channel = searchParams.get("channel") as DemandChannel | null;
  const region = searchParams.get("region");

  if (status) filters.status = status as CampaignFilters["status"];
  if (channel) filters.channel = channel;
  if (region) filters.region = region;

  return filters;
}

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const _gate1 = await requireModuleGate(request, "revops", "read");
  if (_gate1) return _gate1;
  const { searchParams } = new URL(request.url);
  const tenantSlug = context.tenantSlug;
  try {
    const campaigns = await listCampaigns(tenantSlug, buildFilters(searchParams));
    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error("Failed to list campaigns", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to list campaigns" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const _gate2 = await requireModuleGate(request, "revops", "write");
  if (_gate2) return _gate2;
  const body = await request.json().catch(() => ({}));

  const name = body.name ? String(body.name) : "";
  const startDate = body.startDate ? String(body.startDate) : "";
  const budget = body.budget !== undefined ? Number(body.budget) : undefined;

  if (!name) {
    return NextResponse.json({ error: "Missing field: name" }, { status: 400 });
  }
  if (!startDate) {
    return NextResponse.json({ error: "Missing field: startDate" }, { status: 400 });
  }
  if (budget === undefined || Number.isNaN(budget)) {
    return NextResponse.json({ error: "Missing field: budget" }, { status: 400 });
  }

  try {
    const campaign = await createCampaign({
      tenantSlug: context.tenantSlug,
      name,
      objective: body.objective ? String(body.objective) : body.status ? String(body.status) : "",
      channel: (body.channel ?? "email") as DemandChannel,
      region: body.region ? String(body.region) : "Global",
      branch: body.branch ? String(body.branch) : undefined,
      subsidiary: body.subsidiary ? String(body.subsidiary) : "Default",
      startDate,
      endDate: body.endDate ? String(body.endDate) : undefined,
      budget,
      attributionModel: body.attributionModel ?? undefined,
      targetSegments: Array.isArray(body.targetSegments)
        ? body.targetSegments.map(String)
        : typeof body.targetSegments === "string"
        ? String(body.targetSegments)
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : undefined,
      createdBy: context.userId && context.userId !== "unknown" ? context.userId : "system",
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    console.error("Failed to create campaign", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create campaign" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const _gate3 = await requireModuleGate(request, "revops", "write");
  if (_gate3) return _gate3;
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get("id");
  if (!campaignId) {
    return NextResponse.json({ error: "Missing query parameter: id" }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  try {
    const campaign = await updateCampaign(context.tenantSlug, campaignId, {
      name: body.name !== undefined ? String(body.name) : undefined,
      channel: body.channel !== undefined ? (String(body.channel) as DemandChannel) : undefined,
      status: body.status !== undefined ? (String(body.status) as CampaignStatus) : undefined,
      startDate: body.startDate !== undefined ? String(body.startDate) : undefined,
      endDate: body.endDate !== undefined ? String(body.endDate) : undefined,
      budget: body.budget !== undefined ? Number(body.budget) : undefined,
    });
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    return NextResponse.json({ campaign });
  } catch (error) {
    console.error("Failed to update campaign", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update campaign" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const _gate4 = await requireModuleGate(request, "revops", "write");
  if (_gate4) return _gate4;
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get("id");
  if (!campaignId) {
    return NextResponse.json({ error: "Missing query parameter: id" }, { status: 400 });
  }
  try {
    const deleted = await deleteCampaign(context.tenantSlug, campaignId);
    if (!deleted) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete campaign", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete campaign" }, { status: 500 });
  }
}
