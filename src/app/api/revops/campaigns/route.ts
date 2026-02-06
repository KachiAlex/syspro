import { NextRequest, NextResponse } from "next/server";

import { createCampaign, listCampaigns, type CampaignFilters, type DemandChannel } from "@/lib/revops-data";

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
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug")?.trim() || "default";
  const campaigns = listCampaigns(tenantSlug, buildFilters(searchParams));
  return NextResponse.json({ campaigns });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const requiredFields = [
    "tenantSlug",
    "name",
    "objective",
    "channel",
    "region",
    "subsidiary",
    "startDate",
    "budget",
    "createdBy",
  ];

  const missing = requiredFields.find((field) => !body[field]);
  if (missing) {
    return NextResponse.json({ error: `Missing field: ${missing}` }, { status: 400 });
  }

  try {
    const campaign = createCampaign({
      tenantSlug: String(body.tenantSlug),
      name: String(body.name),
      objective: String(body.objective),
      channel: body.channel as DemandChannel,
      region: String(body.region),
      branch: body.branch ? String(body.branch) : undefined,
      subsidiary: String(body.subsidiary),
      startDate: String(body.startDate),
      endDate: body.endDate ? String(body.endDate) : undefined,
      budget: Number(body.budget),
      attributionModel: body.attributionModel ?? undefined,
      targetSegments: Array.isArray(body.targetSegments)
        ? body.targetSegments.map(String)
        : typeof body.targetSegments === "string"
        ? String(body.targetSegments)
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : undefined,
      createdBy: String(body.createdBy),
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create campaign" }, { status: 500 });
  }
}
