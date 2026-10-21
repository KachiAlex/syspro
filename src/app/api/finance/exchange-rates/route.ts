export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { listExchangeRates, upsertExchangeRate, getExchangeRate } from "@/lib/finance/currency";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  const currency = url.searchParams.get("currency") ?? undefined;
  const date = url.searchParams.get("date") ?? undefined;
  try {
    if (currency && date) {
      const rate = await getExchangeRate(context.tenantSlug, currency, date);
      return NextResponse.json({ currency, date, rate });
    }
    const rates = await listExchangeRates(context.tenantSlug, currency);
    return NextResponse.json({ rates });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const schema = z.object({
  currency: z.string().min(3).max(5),
  rateDate: z.string().min(8),
  rate: z.coerce.number().positive(),
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
    await upsertExchangeRate({ tenantSlug: context.tenantSlug, ...parsed.data });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
