export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { disposeAsset, getAssetSchedule } from "@/lib/finance/fixed-assets";
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
    const out = await disposeAsset({
      tenantSlug: context.tenantSlug,
      assetId: id,
      disposalDate: parsed.data.disposalDate,
      method: parsed.data.method,
      proceeds: parsed.data.proceeds,
      proceedsAccountCode: parsed.data.proceedsAccountCode,
      userId: (gate as any).user?.id ?? undefined,
    });
    return NextResponse.json(out);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
