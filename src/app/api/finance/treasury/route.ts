export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  upsertBankReconRule, listBankReconRules, applyReconRules,
  issueBankGuarantee, updateBankGuaranteeStatus, listBankGuarantees,
  sanctionInvoiceDiscounting, settleInvoiceDiscounting, listInvoiceDiscountings,
  upsertSubscriptionPlan, listSubscriptionPlans, createSubscription, listSubscriptions,
  generateSubscriptionInvoices, fetchAndStoreExchangeRates,
} from "@/lib/finance/treasury";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;
  const sp = request.nextUrl.searchParams;
  const tenantSlug = sp.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
  }
  const view = sp.get("view") ?? "recon-rules";
  const status = sp.get("status") ?? undefined;
  switch (view) {
    case "recon-rules":
      return NextResponse.json({ success: true, data: await listBankReconRules(tenantSlug) });
    case "recon-suggestions":
      return NextResponse.json({ success: true, data: await applyReconRules({ tenantSlug, bankAccountCode: sp.get("bankAccountCode") ?? undefined }) });
    case "guarantees":
      return NextResponse.json({ success: true, data: await listBankGuarantees(tenantSlug, status) });
    case "discounting":
      return NextResponse.json({ success: true, data: await listInvoiceDiscountings(tenantSlug, status) });
    case "subscription-plans":
      return NextResponse.json({ success: true, data: await listSubscriptionPlans(tenantSlug) });
    case "subscriptions":
      return NextResponse.json({ success: true, data: await listSubscriptions(tenantSlug, status) });
    default:
      return NextResponse.json({ success: false, error: "view must be one of: recon-rules, recon-suggestions, guarantees, discounting, subscription-plans, subscriptions" }, { status: 400 });
  }
}

const schemas = {
  "upsert-recon-rule": z.object({
    tenantSlug: z.string().min(1), name: z.string().min(1), priority: z.coerce.number().int().optional(),
    matchField: z.enum(["description", "reference"]).optional(), pattern: z.string().min(1),
    accountCode: z.string().optional(), partyType: z.enum(["customer", "vendor"]).optional(),
    partyId: z.string().optional(), amountTolerance: z.coerce.number().optional(), active: z.boolean().optional(),
  }),
  "issue-guarantee": z.object({
    tenantSlug: z.string().min(1), direction: z.enum(["issued", "received"]),
    beneficiary: z.string().min(1), bank: z.string().min(1), amount: z.coerce.number().positive(),
    currency: z.string().optional(), startDate: z.string().min(8), endDate: z.string().min(8),
    marginAmount: z.coerce.number().optional(), notes: z.string().optional(),
  }),
  "update-guarantee": z.object({
    tenantSlug: z.string().min(1), id: z.string().min(1),
    status: z.enum(["open", "claimed", "released", "expired"]),
  }),
  "sanction-discounting": z.object({
    tenantSlug: z.string().min(1), invoiceId: z.string().min(1), bank: z.string().min(1),
    loanAmount: z.coerce.number().positive(), disbursementDate: z.string().min(8),
    periodDays: z.coerce.number().int().optional(),
  }),
  "settle-discounting": z.object({
    tenantSlug: z.string().min(1), id: z.string().min(1), settledDate: z.string().min(8),
  }),
  "upsert-plan": z.object({
    tenantSlug: z.string().min(1), name: z.string().min(1), item: z.string().min(1),
    unitPrice: z.coerce.number().positive(), qty: z.coerce.number().optional(),
    interval: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]).optional(),
    revenueAccountCode: z.string().optional(), active: z.boolean().optional(),
  }),
  "create-subscription": z.object({
    tenantSlug: z.string().min(1), customerId: z.string().min(1), planId: z.string().min(1),
    startDate: z.string().min(8), endDate: z.string().optional(),
    partyAccountCode: z.string().optional(), bankAccountCode: z.string().optional(),
  }),
  "generate-invoices": z.object({
    tenantSlug: z.string().min(1), asOf: z.string().optional(),
  }),
  "fetch-rates": z.object({
    tenantSlug: z.string().min(1), baseCurrency: z.string().optional(),
    currencies: z.array(z.string().min(3)).min(1), providerUrl: z.string().url().optional(),
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
    const userId = (_scope as any).user?.id;
    let data: unknown;
    switch (action) {
      case "upsert-recon-rule": data = await upsertBankReconRule(input); break;
      case "issue-guarantee": data = await issueBankGuarantee({ ...input, userId }); break;
      case "update-guarantee": data = await updateBankGuaranteeStatus(input); break;
      case "sanction-discounting": data = await sanctionInvoiceDiscounting({ ...input, userId }); break;
      case "settle-discounting": data = await settleInvoiceDiscounting({ ...input, userId }); break;
      case "upsert-plan": data = await upsertSubscriptionPlan(input); break;
      case "create-subscription": data = await createSubscription(input); break;
      case "generate-invoices": data = await generateSubscriptionInvoices({ ...input, userId }); break;
      case "fetch-rates": data = await fetchAndStoreExchangeRates(input); break;
    }
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status ?? 500 });
  }
}
