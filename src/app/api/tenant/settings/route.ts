import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenantSettings, setTenantSettings } from "@/lib/tenant/currency";
import { ensureTenantTable } from "@/lib/tenant/tenant-table";
import { db } from "@/lib/sql-client";

const updateSchema = z.object({
  tenantSlug: z.string().min(1),
  currency: z.string().min(1).max(5),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug required" }, { status: 400 });
  }
  try {
    await ensureTenantTable(db.sql);
    const settings = await getTenantSettings(tenantSlug, db.sql);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Failed to get tenant settings", error);
    return NextResponse.json({ error: "Failed to get settings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    await ensureTenantTable(db.sql);
    await setTenantSettings(parsed.data.tenantSlug, [{ id: "currency", value: parsed.data.currency }], db.sql);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update tenant settings", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { tenantSlug, settings } = body as { tenantSlug?: string; settings?: Array<{ id: string; value: any }> };
  if (!tenantSlug || !Array.isArray(settings)) {
    return NextResponse.json({ error: "tenantSlug and settings array required" }, { status: 400 });
  }

  try {
    await ensureTenantTable(db.sql);
  } catch (tableErr) {
    console.error("ensureTenantTable failed:", tableErr);
    return NextResponse.json({ error: "DB schema init failed", detail: (tableErr as Error).message }, { status: 500 });
  }

  try {
    const cleanSettings = settings.map((s: any) => ({ id: s.id, value: s.value }));
    await setTenantSettings(tenantSlug, cleanSettings, db.sql);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update tenant settings:", error);
    return NextResponse.json({ error: "Failed to update settings", detail: (error as Error).message }, { status: 500 });
  }
}
