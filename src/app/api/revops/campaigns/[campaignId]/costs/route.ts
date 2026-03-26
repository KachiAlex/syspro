import { NextRequest, NextResponse } from "next/server";

import { listCampaignCosts, recordCampaignCost } from "@/lib/revops-data";

export async function GET(request: NextRequest, context: any) {
  const { params } = context;
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug")?.trim() || "default";
  const costs = listCampaignCosts(tenantSlug, params.campaignId);
  return NextResponse.json({ costs });
}

export async function POST(request: NextRequest, context: any) {
  const { params } = context;
  const body = await request.json().catch(() => ({}));
  const requiredFields = [
    "tenantSlug",
    "amount",
    "currency",
    "costCenter",
    "description",
    "spendDate",
    "region",
    "subsidiary",
    "recordedBy",
  ];
  const missing = requiredFields.find((field) => !body[field]);
  if (missing) {
    return NextResponse.json({ error: `Missing field: ${missing}` }, { status: 400 });
  }

  try {
    const cost = recordCampaignCost({
      tenantSlug: String(body.tenantSlug),
      campaignId: params.campaignId,
      amount: Number(body.amount),
      currency: String(body.currency),
      costCenter: String(body.costCenter),
      description: String(body.description),
      spendDate: String(body.spendDate),
      region: String(body.region),
      branch: body.branch ? String(body.branch) : undefined,
      subsidiary: String(body.subsidiary),
      recordedBy: String(body.recordedBy),
      approvedBy: body.approvedBy ? String(body.approvedBy) : undefined,
    });

    return NextResponse.json({ cost }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to record cost" }, { status: 500 });
  }
}
