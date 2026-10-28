export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAsset, listAssets, getAssetSchedule, ensureAssetTables } from "@/lib/finance/fixed-assets";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess, requireDocAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  const assetId = url.searchParams.get("assetId");
  try {
    await ensureAssetTables();
    if (assetId) {
      const schedule = await getAssetSchedule(context.tenantSlug, assetId);
      return NextResponse.json({ schedule });
    }
    const assets = await listAssets(context.tenantSlug, url.searchParams.get("status") ?? undefined);
    return NextResponse.json({ assets });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const createSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  acquisitionDate: z.string().min(8),
  cost: z.coerce.number().positive(),
  salvageValue: z.coerce.number().nonnegative().optional(),
  usefulLifeMonths: z.coerce.number().int().min(1),
  method: z.enum(["straight_line", "reducing_balance"]).optional(),
  depreciationStartDate: z.string().optional(),
  assetAccountCode: z.string().optional(),
  depExpenseAccountCode: z.string().optional(),
  accumDepAccountCode: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const gate = await requireDocAccess(request, "asset", "edit", "finance", "write");
  if (!gate.ok) return gate.response;
  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
    }
    const out = await createAsset({ tenantSlug: context.tenantSlug, ...parsed.data });
    return NextResponse.json(out, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
