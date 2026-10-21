export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  upsertTaxTemplate, listTaxTemplates, setItemTaxTemplate, setPartyTaxCategory,
  upsertTaxRule, resolveTaxTemplate, computeTaxLines,
  upsertWithholdingCategory, listWithholdingCategories, computeAndRecordWithholding,
  upsertShippingRule, resolveShippingCharge,
} from "@/lib/finance/tax-engine";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;
  const sp = request.nextUrl.searchParams;
  const tenantSlug = sp.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
  }
  const view = sp.get("view") ?? "templates";
  switch (view) {
    case "templates":
      return NextResponse.json({ success: true, data: await listTaxTemplates(tenantSlug, sp.get("direction") ?? undefined) });
    case "withholding":
      return NextResponse.json({ success: true, data: await listWithholdingCategories(tenantSlug) });
    case "resolve": {
      const data = await resolveTaxTemplate({
        tenantSlug,
        direction: (sp.get("direction") ?? "sales") as any,
        partyType: sp.get("partyType") ?? undefined,
        partyId: sp.get("partyId") ?? undefined,
        item: sp.get("item") ?? undefined,
        amount: sp.get("amount") ? Number(sp.get("amount")) : undefined,
        date: sp.get("date") ?? undefined,
      });
      return NextResponse.json({ success: true, data });
    }
    default:
      return NextResponse.json({ success: false, error: "view must be one of: templates, withholding, resolve" }, { status: 400 });
  }
}

const schemas = {
  "upsert-template": z.object({
    tenantSlug: z.string().min(1), name: z.string().min(1),
    direction: z.enum(["sales", "purchase", "both"]).optional(),
    lines: z.array(z.object({
      description: z.string().optional(), rate: z.coerce.number(), accountCode: z.string().optional(),
    })),
  }),
  "set-item-template": z.object({
    tenantSlug: z.string().min(1), item: z.string().min(1), taxTemplateId: z.string().min(1),
  }),
  "set-party-category": z.object({
    tenantSlug: z.string().min(1), partyType: z.enum(["customer", "vendor"]),
    partyId: z.string().min(1), taxCategory: z.string().min(1),
  }),
  "upsert-rule": z.object({
    tenantSlug: z.string().min(1), id: z.string().optional(), name: z.string().min(1),
    priority: z.coerce.number().int().optional(), direction: z.enum(["sales", "purchase"]),
    taxCategory: z.string().optional(), partyType: z.string().optional(), partyId: z.string().optional(),
    item: z.string().optional(), minAmount: z.coerce.number().optional(), maxAmount: z.coerce.number().optional(),
    validFrom: z.string().optional(), validTo: z.string().optional(),
    taxTemplateId: z.string().min(1), active: z.boolean().optional(),
  }),
  "compute-taxes": z.object({
    tenantSlug: z.string().min(1), amount: z.coerce.number().positive(),
    lines: z.array(z.object({ description: z.string().optional(), rate: z.coerce.number(), accountCode: z.string().optional() })),
  }),
  "upsert-withholding": z.object({
    tenantSlug: z.string().min(1), name: z.string().min(1), accountCode: z.string().optional(),
    rates: z.array(z.object({
      rate: z.coerce.number(), singleThreshold: z.coerce.number().optional(), cumulativeThreshold: z.coerce.number().optional(),
    })),
  }),
  "compute-withholding": z.object({
    tenantSlug: z.string().min(1), categoryId: z.string().min(1),
    partyType: z.enum(["vendor", "customer"]), partyId: z.string().min(1),
    documentType: z.enum(["bill", "invoice"]), documentId: z.string().min(1),
    taxableAmount: z.coerce.number().positive(), fiscalYear: z.coerce.number().int().optional(),
  }),
  "upsert-shipping": z.object({
    tenantSlug: z.string().min(1), name: z.string().min(1),
    minValue: z.coerce.number().optional(), maxValue: z.coerce.number().optional(),
    minWeight: z.coerce.number().optional(), maxWeight: z.coerce.number().optional(),
    chargeType: z.enum(["flat", "percent"]), chargeValue: z.coerce.number(),
    accountCode: z.string().optional(), active: z.boolean().optional(),
  }),
  "resolve-shipping": z.object({
    tenantSlug: z.string().min(1), orderValue: z.coerce.number().nonnegative(),
    weight: z.coerce.number().optional(),
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
    switch (action) {
      case "upsert-template": data = await upsertTaxTemplate(input); break;
      case "set-item-template": data = await setItemTaxTemplate(input); break;
      case "set-party-category": data = await setPartyTaxCategory(input); break;
      case "upsert-rule": data = await upsertTaxRule(input); break;
      case "compute-taxes": data = computeTaxLines(input.amount, input.lines); break;
      case "upsert-withholding": data = await upsertWithholdingCategory(input); break;
      case "compute-withholding": data = await computeAndRecordWithholding(input); break;
      case "upsert-shipping": data = await upsertShippingRule(input); break;
      case "resolve-shipping": data = await resolveShippingCharge(input); break;
    }
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status ?? 500 });
  }
}
