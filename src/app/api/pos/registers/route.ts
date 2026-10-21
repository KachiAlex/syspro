export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { listRegisters, createRegister, setRegisterActive } from "@/lib/pos/registers";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const gate = await requireModuleAccess(request, "sales", "read");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "read");
  const includeInactive = new URL(request.url).searchParams.get("all") === "1";
  return NextResponse.json({ registers: await listRegisters(context.tenantSlug, includeInactive) });
}

const schema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(120),
  warehouseId: z.string().optional(),
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
    const register = await createRegister(context.tenantSlug, parsed.data);
    return NextResponse.json({ register }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requireModuleAccess(request, "sales", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await setRegisterActive(context.tenantSlug, body.id, body.isActive !== false);
  return NextResponse.json({ ok: true });
}
