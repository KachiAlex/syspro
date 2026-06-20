import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenantCurrency, setTenantCurrency } from "@/lib/tenant/currency";
import { ensureTenantTable } from "@/lib/tenant/tenant-table";
import { sql as SQL } from "@/lib/sql-client";

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
    await ensureTenantTable(SQL);
    const currency = await getTenantCurrency(tenantSlug);
    return NextResponse.json({ currency });
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
    await ensureTenantTable(SQL);
    await setTenantCurrency(parsed.data.tenantSlug, parsed.data.currency);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update tenant settings", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
