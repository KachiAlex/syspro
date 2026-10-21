export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addCashMovement, listCashMovements } from "@/lib/pos/shifts";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const gate = await requireModuleAccess(request, "sales", "read");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "read");
  const shiftId = new URL(request.url).searchParams.get("shiftId");
  if (!shiftId) return NextResponse.json({ error: "shiftId is required" }, { status: 400 });
  return NextResponse.json({ movements: await listCashMovements(context.tenantSlug, shiftId) });
}

const schema = z.object({
  shiftId: z.string().optional(),
  registerId: z.string().optional(),
  type: z.enum(["pay_in", "pay_out", "drop"]),
  amount: z.coerce.number().positive(),
  reason: z.string().max(300).optional(),
});

export async function POST(request: NextRequest) {
  const gate = await requireModuleAccess(request, "sales", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await addCashMovement(context.tenantSlug, {
      ...parsed.data,
      createdBy: context.userId ?? undefined,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 422 });
  }
}
