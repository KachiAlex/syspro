export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createLandedCostVoucher, listLandedCostVouchers } from "@/lib/inventory/landed-cost";
import { gateOrRun } from "@/lib/finance/gated-actions";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

const createSchema = z.object({
  referenceId: z.string().min(1),
  chargeType: z.enum(["freight", "customs_duty", "insurance", "other"]),
  totalAmount: z.coerce.number().positive(),
  allocationMethod: z.enum(["value", "quantity", "manual"]).optional(),
  items: z.array(z.object({
    sku: z.string().min(1),
    quantity: z.coerce.number().positive(),
    unitCost: z.coerce.number().min(0),
    allocatedAmount: z.coerce.number().min(0).optional(),
  })).min(1),
  payableAccountCode: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const gate = await requireModuleAccess(request, "admin", "read");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "read");
  const { searchParams } = new URL(request.url);
  const vouchers = await listLandedCostVouchers(context.tenantSlug, {
    referenceId: searchParams.get("referenceId") ?? undefined,
    limit: parseInt(searchParams.get("limit") ?? "100"),
  });
  return NextResponse.json({ vouchers });
}

export async function POST(request: NextRequest) {
  const gate = await requireModuleAccess(request, "admin", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    // Capitalizing charges writes unit costs AND a journal — route through
    // the maker-checker registry; ungated posts immediately as before.
    const gated = await gateOrRun(context.tenantSlug, "landed_cost", {
      ...parsed.data,
      createdBy: context.userId ?? "unknown",
    }, { requestedBy: context.userId ?? "unknown" });
    if (gated.status === "pending") {
      return NextResponse.json({
        approvalId: (gated as any).approvalId,
        pendingApproval: true,
      }, { status: 202 });
    }
    if (gated.status === "denied") {
      return NextResponse.json({ error: (gated as any).error ?? "Denied" }, { status: 403 });
    }
    return NextResponse.json({ voucher: (gated as any).result }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 422 });
  }
}
