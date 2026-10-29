export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { deactivatePromotion, listPromotions, upsertPromotion } from "@/lib/pos/promotions";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "pos", "read");
  if (!gate.ok) return gate.response;
  try {
    const promotions = await listPromotions(
      context.tenantSlug, new URL(request.url).searchParams.get("all") === "true"
    );
    return NextResponse.json({ promotions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const upsertSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["percent", "amount", "bogo", "bundle"]),
  percent: z.coerce.number().optional(),
  amount: z.coerce.number().optional(),
  buyQty: z.coerce.number().int().optional(),
  getQty: z.coerce.number().int().optional(),
  minQty: z.coerce.number().int().optional(),
  bundlePrice: z.coerce.number().optional(),
  skus: z.array(z.string()).optional(),
  activeFrom: z.string().optional(),
  activeTo: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const gate = await requireModuleAccess(request, "pos", "write");
  if (!gate.ok) return gate.response;
  try {
    const parsed = upsertSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
    }
    const out = await upsertPromotion(context.tenantSlug, parsed.data as any);
    return NextResponse.json(out, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const gate = await requireModuleAccess(request, "pos", "write");
  if (!gate.ok) return gate.response;
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await deactivatePromotion(context.tenantSlug, id);
    return NextResponse.json({ deactivated: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
