export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  upsertPeggedCurrency, listPeggedCurrencies, resolveRateWithPegs,
} from "@/lib/finance/pegged";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;
  const sp = request.nextUrl.searchParams;
  const tenantSlug = sp.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
  }
  const view = sp.get("view") ?? "list";
  switch (view) {
    case "list":
      return NextResponse.json({ success: true, data: await listPeggedCurrencies(tenantSlug) });
    case "resolve": {
      const currency = sp.get("currency");
      if (!currency) {
        return NextResponse.json({ success: false, error: "currency required" }, { status: 400 });
      }
      try {
        const data = await resolveRateWithPegs({
          tenantSlug, currency, date: sp.get("date") ?? undefined,
        });
        return NextResponse.json({ success: true, data });
      } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 400 });
      }
    }
    default:
      return NextResponse.json({ success: false, error: "view must be 'list' or 'resolve'" }, { status: 400 });
  }
}

const schema = z.object({
  tenantSlug: z.string().min(1), currency: z.string().min(3).max(3),
  peggedTo: z.string().min(3).max(3), rate: z.coerce.number().positive(),
  active: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const data = await upsertPeggedCurrency(parsed.data);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status ?? 500 });
  }
}
