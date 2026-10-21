export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import { listHolidays, upsertHoliday, deleteHoliday } from "@/lib/hr/db";

const upsertSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1).max(160),
  weeklyOff: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const gate = await requireModuleAccess(request, "people", "read");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "read");
  const year = Number(new URL(request.url).searchParams.get("year")) || undefined;
  return NextResponse.json({ holidays: await listHolidays(context.tenantSlug, year) });
}

export async function POST(request: NextRequest) {
  const gate = await requireModuleAccess(request, "people", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const body = await request.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json({ holiday: await upsertHoliday(context.tenantSlug, parsed.data) }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const gate = await requireModuleAccess(request, "people", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const ok = await deleteHoliday(context.tenantSlug, id);
  if (!ok) return NextResponse.json({ error: "Holiday not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
