export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAssetSchedule, listAssets } from "@/lib/finance/fixed-assets";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  const { id } = await params;
  try {
    const schedule = await getAssetSchedule(context.tenantSlug, id);
    return NextResponse.json({ schedule });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const disposeSchema = z.object({
  action: z.literal("dispose"),
  disposalDate: z.string().min(8),
  method: z.enum(["sale", "scrap", "donation", "write_off"]),
  proceeds: z.coerce.number().nonnegative().optional(),
  proceedsAccountCode: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: Params) {
  const context = validateTenantContext(request, "write");
  const gate = await requireModuleAccess(request, "finance", "write");
  if (!gate.ok) return gate.response;
  const { id } = await params;
  try {
    const parsed = disposeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
    }
    // Disposal derecognizes the asset and posts gain/loss — always routed
    // through the approvals engine unless a system-matrix band auto-approves.
    const asset = (await listAssets(context.tenantSlug)).find((a: any) => a.id === id);
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    const nbv = Math.round((Number(asset.cost) - Number(asset.accumulated_depreciation)) * 100) / 100;
    const { gateOrRun } = await import("@/lib/finance/gated-actions");
    const outcome = await gateOrRun(
      context.tenantSlug,
      "asset_disposal",
      {
        assetId: id,
        assetName: asset.name,
        method: parsed.data.method,
        disposalDate: parsed.data.disposalDate,
        proceeds: parsed.data.proceeds,
        proceedsAccountCode: parsed.data.proceedsAccountCode,
        netBookValue: nbv,
      },
      { requestedBy: (gate as any).user?.id ?? "unknown" }
    );
    if (outcome.status === "pending") {
      return NextResponse.json(
        { success: true, pendingApproval: true, approvalId: outcome.approvalId },
        { status: 202 }
      );
    }
    if (outcome.status === "denied") {
      return NextResponse.json({ error: outcome.error }, { status: 403 });
    }
    return NextResponse.json(outcome.result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
