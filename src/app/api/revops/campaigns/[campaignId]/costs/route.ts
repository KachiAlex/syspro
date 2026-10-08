export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";

import { listCampaignCosts, recordCampaignCost } from "@/lib/revops-data";

export async function GET(request: NextRequest, context: any) {
  const { params } = context;
  const ctx = validateTenantContext(request, "read");
  const _gate1 = await requireModuleGate(request, "revops", "read");
  if (_gate1) return _gate1;
  try {
    const costs = await listCampaignCosts(ctx.tenantSlug, params.campaignId);
    return NextResponse.json({ costs });
  } catch (error) {
    console.error("Failed to list campaign costs", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to list costs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: any) {
  const { params } = context;
  const ctx = validateTenantContext(request, "write");
  const _gate2 = await requireModuleGate(request, "revops", "write");
  if (_gate2) return _gate2;
  const body = await request.json().catch(() => ({}));
  const requiredFields = [
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
    const cost = await recordCampaignCost({
      tenantSlug: ctx.tenantSlug,
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
    if (error instanceof Error && error.message === "Campaign not found") {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    console.error("Failed to record campaign cost", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to record cost" }, { status: 500 });
  }
}
