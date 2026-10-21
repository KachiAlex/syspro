export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { getPosConfig, setPosConfig } from "@/lib/pos/config";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const gate = await requireModuleAccess(request, "sales", "read");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "read");
  return NextResponse.json(await getPosConfig(context.tenantSlug));
}

const patchSchema = z.object({
  vatRate: z.coerce.number().min(0).max(100).optional(),
  cashRoundingStep: z.coerce.number().min(0).optional(),
  cardFeePct: z.coerce.number().min(0).max(100).optional(),
  varianceTolerance: z.coerce.number().min(0).optional(),
  loyalty: z.object({
    enabled: z.boolean().optional(),
    earnDivisor: z.coerce.number().min(1).optional(),
    redeemValue: z.coerce.number().min(0).optional(),
  }).optional(),
});

export async function PATCH(request: NextRequest) {
  const gate = await requireModuleAccess(request, "sales", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json(await setPosConfig(context.tenantSlug, parsed.data));
}
