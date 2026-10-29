export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { closeShift, getShiftSummary } from "@/lib/pos/shifts";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const gate = await requireModuleAccess(request, "pos", "read");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "read");
  const { id } = await params;
  const summary = await getShiftSummary(context.tenantSlug, id);
  if (!summary) return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  return NextResponse.json(summary);
}

const closeSchema = z.object({
  action: z.literal("close"),
  closingCounted: z.coerce.number().min(0),
  varianceReason: z.string().max(300).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(request: NextRequest, { params }: Params) {
  const gate = await requireModuleAccess(request, "pos", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const { id } = await params;
  const body = await request.json();
  const parsed = closeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  const result = await closeShift(context.tenantSlug, id, {
    closingCounted: parsed.data.closingCounted,
    closedBy: context.userId,
    notes: parsed.data.notes,
    varianceReason: parsed.data.varianceReason,
  });
  if ("error" in result) {
    return NextResponse.json(result, { status: /not found/.test(result.error) ? 404 : 409 });
  }
  return NextResponse.json({ shift: result });
}
