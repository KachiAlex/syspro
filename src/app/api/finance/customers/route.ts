export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { listCustomers, upsertCustomer, customerOpenBalance } from "@/lib/finance/credit-control";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  const code = url.searchParams.get("customerCode");
  try {
    if (code) {
      const open = await customerOpenBalance(context.tenantSlug, code);
      return NextResponse.json({ customerCode: code, openBalance: open });
    }
    const customers = await listCustomers(context.tenantSlug);
    return NextResponse.json({ customers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const schema = z.object({
  customerCode: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email().nullish(),
  creditLimit: z.coerce.number().nonnegative().nullish(),
  creditHold: z.boolean().optional(),
  paymentTermId: z.string().uuid().nullish(),
  defaultCurrency: z.string().optional(),
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
    await upsertCustomer({ tenantSlug: context.tenantSlug, ...parsed.data });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
