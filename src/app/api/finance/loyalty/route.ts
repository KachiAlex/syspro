export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  upsertLoyaltyProgram, listLoyaltyPrograms, earnOnInvoice, redeemOnInvoice,
} from "@/lib/finance/loyalty-program";
import { loyaltyBalance } from "@/lib/pos/loyalty";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;
  const sp = request.nextUrl.searchParams;
  const tenantSlug = sp.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
  }
  const view = sp.get("view") ?? "programs";
  switch (view) {
    case "programs":
      return NextResponse.json({ success: true, data: await listLoyaltyPrograms(tenantSlug) });
    case "balance": {
      const customerCode = sp.get("customerCode");
      if (!customerCode) {
        return NextResponse.json({ success: false, error: "customerCode required" }, { status: 400 });
      }
      return NextResponse.json({ success: true, data: await loyaltyBalance(tenantSlug, customerCode) });
    }
    default:
      return NextResponse.json({ success: false, error: "view must be 'programs' or 'balance'" }, { status: 400 });
  }
}

const schemas = {
  "upsert-program": z.object({
    tenantSlug: z.string().min(1), name: z.string().min(1),
    earnRate: z.coerce.number().nonnegative(), redeemValue: z.coerce.number().positive(),
    minPointsToRedeem: z.coerce.number().int().optional(), maxRedeemPct: z.coerce.number().optional(),
    expenseAccountCode: z.string().optional(), expiryDays: z.coerce.number().int().optional(),
    active: z.boolean().optional(),
  }),
  earn: z.object({
    tenantSlug: z.string().min(1), programId: z.string().min(1),
    customerCode: z.string().min(1), invoiceId: z.string().min(1),
    invoiceAmount: z.coerce.number().positive(),
  }),
  redeem: z.object({
    tenantSlug: z.string().min(1), programId: z.string().min(1),
    customerCode: z.string().min(1), invoiceId: z.string().min(1),
    invoiceAmount: z.coerce.number().positive(), points: z.coerce.number().int().optional(),
  }),
} as const;

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const body = await request.json();
    const action = body?.action as keyof typeof schemas | undefined;
    const schema = action ? schemas[action] : undefined;
    if (!schema) {
      return NextResponse.json(
        { success: false, error: `action must be one of: ${Object.keys(schemas).join(", ")}` },
        { status: 400 },
      );
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const input = parsed.data as any;
    let data: unknown;
    switch (action) {
      case "upsert-program": data = await upsertLoyaltyProgram(input); break;
      case "earn": data = await earnOnInvoice(input); break;
      case "redeem": data = await redeemOnInvoice(input); break;
    }
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status ?? 500 });
  }
}
