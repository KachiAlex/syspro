export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAdvance, applyAdvance, refundAdvance } from "@/lib/finance/imprest";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  const { id } = await params;
  try {
    return NextResponse.json({ advance: await getAdvance(context.tenantSlug, id) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("apply"),
    amount: z.coerce.number().positive(),
    expenseId: z.string().optional(),
    expenseAccountCode: z.string().optional(),
    entryDate: z.string().min(8),
  }),
  z.object({
    action: z.literal("refund"),
    amount: z.coerce.number().positive(),
    fundId: z.string().uuid().optional(),
    entryDate: z.string().min(8),
  }),
]);

export async function POST(request: NextRequest, { params }: Params) {
  const context = validateTenantContext(request, "write");
  const gate = await requireModuleAccess(request, "finance", "write");
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const tenantSlug = context.tenantSlug;
    const out = parsed.data.action === "apply"
      ? await applyAdvance({ tenantSlug, advanceId: id, ...parsed.data })
      : await refundAdvance({ tenantSlug, advanceId: id, ...parsed.data });
    return NextResponse.json(out);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
