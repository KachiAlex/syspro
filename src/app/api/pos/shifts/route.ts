export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getOpenShift, listShifts, openShift } from "@/lib/pos/shifts";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const gate = await requireModuleAccess(request, "pos", "read");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "read");
  const { searchParams } = new URL(request.url);
  if (searchParams.get("current") === "1") {
    const registerId = searchParams.get("registerId") ?? null;
    return NextResponse.json({ shift: await getOpenShift(context.tenantSlug, registerId) });
  }
  const shifts = await listShifts(context.tenantSlug, {
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    registerId: searchParams.get("registerId") ?? undefined,
    limit: Number(searchParams.get("limit") ?? 50) || 50,
  });
  return NextResponse.json({ shifts });
}

const openSchema = z.object({
  openingFloat: z.coerce.number().min(0).default(0),
  registerId: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const gate = await requireModuleAccess(request, "pos", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const body = await request.json().catch(() => ({}));
  const parsed = openSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const shift = await openShift(context.tenantSlug, {
      ...parsed.data,
      openedBy: context.userId,
    });
    return NextResponse.json({ shift }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
}
