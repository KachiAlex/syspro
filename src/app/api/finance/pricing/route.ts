export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  upsertPricingRule, listPricingRules, resolvePrice,
  upsertPromotionalScheme, upsertCouponCode, redeemCoupon,
} from "@/lib/finance/pricing";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;
  const sp = request.nextUrl.searchParams;
  const tenantSlug = sp.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
  }
  const view = sp.get("view") ?? "rules";
  if (view === "rules") {
    return NextResponse.json({ success: true, data: await listPricingRules(tenantSlug) });
  }
  if (view === "resolve") {
    const data = await resolvePrice({
      tenantSlug,
      item: sp.get("item") ?? "",
      itemCategory: sp.get("itemCategory") ?? undefined,
      qty: sp.get("qty") ? Number(sp.get("qty")) : undefined,
      partyType: sp.get("partyType") ?? undefined,
      partyId: sp.get("partyId") ?? undefined,
      basePrice: Number(sp.get("basePrice") ?? 0),
      unitCost: sp.get("unitCost") ? Number(sp.get("unitCost")) : undefined,
      date: sp.get("date") ?? undefined,
    });
    return NextResponse.json({ success: true, data });
  }
  return NextResponse.json({ success: false, error: "view must be 'rules' or 'resolve'" }, { status: 400 });
}

const schemas = {
  "upsert-rule": z.object({
    tenantSlug: z.string().min(1), name: z.string().min(1), priority: z.coerce.number().int().optional(),
    item: z.string().optional(), itemCategory: z.string().optional(),
    partyType: z.enum(["customer", "customer_group"]).optional(), partyId: z.string().optional(),
    minQty: z.coerce.number().optional(), validFrom: z.string().optional(), validTo: z.string().optional(),
    mode: z.enum(["price", "discount_pct", "margin"]), value: z.coerce.number(), active: z.boolean().optional(),
  }),
  "upsert-scheme": z.object({
    tenantSlug: z.string().min(1), name: z.string().min(1),
    rules: z.array(z.object({
      item: z.string().optional(), minQty: z.coerce.number().optional(),
      discountPct: z.coerce.number().optional(), freeItem: z.string().optional(), freeQty: z.coerce.number().optional(),
    })),
    validFrom: z.string().optional(), validTo: z.string().optional(), active: z.boolean().optional(),
  }),
  "upsert-coupon": z.object({
    tenantSlug: z.string().min(1), code: z.string().min(1), description: z.string().optional(),
    discountType: z.enum(["percent", "fixed"]), discountValue: z.coerce.number().positive(),
    minOrderValue: z.coerce.number().optional(), validFrom: z.string().optional(), validTo: z.string().optional(),
    maxUses: z.coerce.number().int().optional(), active: z.boolean().optional(),
  }),
  "redeem-coupon": z.object({
    tenantSlug: z.string().min(1), code: z.string().min(1), orderValue: z.coerce.number().positive(),
    date: z.string().optional(),
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
      return NextResponse.json({ success: false, error: `action must be one of: ${Object.keys(schemas).join(", ")}` }, { status: 400 });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const input = parsed.data as any;
    let data: unknown;
    let pendingApproval: { approvalId: string } | null = null;
    if (action === "upsert-rule" || action === "upsert-scheme" || action === "upsert-coupon") {
      // Pricing policy changes (rules, schemes, coupons) are always routed
      // through the approval chain — the upsert replays from approval
      // metadata on approval.
      const { initiateApproval } = await import("@/lib/finance/approvals");
      const ref = input.code ?? input.name ?? action;
      const approval = await initiateApproval({
        tenantSlug: input.tenantSlug,
        entityType: "pricing_change",
        entityId: `pc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        requestedBy: (_scope as any).user?.id ?? "system",
        entityData: {
          amount: Number(input.discountValue ?? input.value ?? 0),
          reference: `Pricing change — ${ref}`,
          requestedByName: (_scope as any).user?.name ?? (_scope as any).user?.id,
          change: { action, input },
        },
      });
      pendingApproval = { approvalId: approval.id };
    } else {
      switch (action) {
        case "redeem-coupon": data = await redeemCoupon(input); break;
      }
    }
    return NextResponse.json({ success: true, data, pendingApproval });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status ?? 500 });
  }
}
