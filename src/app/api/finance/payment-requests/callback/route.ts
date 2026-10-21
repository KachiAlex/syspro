export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { handlePaymentCallback } from "@/lib/finance/gateway";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

const schema = z.object({
  provider: z.enum(["paystack", "flutterwave", "stripe", "manual"]),
  reference: z.string().min(1),
  providerReference: z.string().optional(),
  status: z.enum(["paid", "failed"]),
  paidAmount: z.coerce.number().positive().optional(),
  paymentDate: z.string().min(8),
});

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const gate = await requireModuleAccess(request, "finance", "write");
  if (!gate.ok) return gate.response;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const out = await handlePaymentCallback({
      tenantSlug: context.tenantSlug, ...parsed.data,
    });
    return NextResponse.json(out);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
