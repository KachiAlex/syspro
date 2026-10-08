export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";

import { getSalesPerformanceSnapshot, upsertSalesTarget } from "@/lib/revops-data";
import { randomUUID } from "crypto";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const _gate1 = await requireModuleGate(request, "revops", "read");
  if (_gate1) return _gate1;
  const tenantSlug = context.tenantSlug;
  try {
    const payload = await getSalesPerformanceSnapshot(tenantSlug);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Failed to load sales performance", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load sales performance" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const _gate = await requireModuleGate(request, "revops", "write");
  if (_gate) return _gate;
  const body = await request.json().catch(() => ({}));
  const required = ["period", "periodType", "ownerType", "ownerName", "targetAmount"];
  const missing = required.find((field) => body[field] === undefined || body[field] === null || body[field] === "");
  if (missing) {
    return NextResponse.json({ error: `Missing field: ${missing}` }, { status: 400 });
  }
  if (!["monthly", "quarterly"].includes(String(body.periodType))) {
    return NextResponse.json({ error: "periodType must be monthly or quarterly" }, { status: 400 });
  }
  if (!["team", "rep"].includes(String(body.ownerType))) {
    return NextResponse.json({ error: "ownerType must be team or rep" }, { status: 400 });
  }
  const targetAmount = Number(body.targetAmount);
  if (!Number.isFinite(targetAmount) || targetAmount < 0) {
    return NextResponse.json({ error: "targetAmount must be a non-negative number" }, { status: 400 });
  }

  try {
    const now = new Date().toISOString();
    const target = await upsertSalesTarget({
      id: body.id ? String(body.id) : randomUUID(),
      tenantSlug: context.tenantSlug,
      period: String(body.period),
      periodType: body.periodType,
      region: body.region ? String(body.region) : "",
      branch: body.branch ? String(body.branch) : undefined,
      subsidiary: body.subsidiary ? String(body.subsidiary) : "",
      ownerType: body.ownerType,
      ownerId: body.ownerId ? String(body.ownerId) : "",
      ownerName: String(body.ownerName),
      targetAmount,
      achievedAmount: 0,
      currency: body.currency ? String(body.currency) : "NGN",
      createdBy: context.userId ?? "system",
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json({ target }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save sales target";
    if (message === "Sales target not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("Failed to save sales target", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
