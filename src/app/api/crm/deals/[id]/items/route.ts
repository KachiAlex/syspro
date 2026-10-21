export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveCrmAuth, canAccessCrmRecord } from "@/lib/crm/auth";
import { getDeal, listDealItems, setDealItems } from "@/lib/crm/db";

const itemSchema = z.object({
  sku: z.string().max(80).optional(),
  description: z.string().min(1).max(300),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
});

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const auth = await resolveCrmAuth(request);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const deal = await getDeal(params.id, auth.session.tenantSlug);
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  return NextResponse.json({ items: await listDealItems(params.id, auth.session.tenantSlug) });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const auth = await resolveCrmAuth(request);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const deal = await getDeal(params.id, auth.session.tenantSlug);
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  if (!(await canAccessCrmRecord(auth, deal))) {
    return NextResponse.json({ error: "You can only edit your own deals" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const parsed = z.object({ items: z.array(itemSchema) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json({ items: await setDealItems(params.id, auth.session.tenantSlug, parsed.data.items) });
}
