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
import { requireModuleAccess, requireDocAccess } from "@/lib/api-auth";
import { withProcessLog } from "@/lib/finance/process-log";

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
  const _scope = await requireDocAccess(request, "treasury_document", "submit", "finance", "write");
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
    let pendingApproval: { approvalId: string } | null = null;
    switch (action) {
      case "upsert-recon-rule": data = await upsertBankReconRule(input); break;
      case "issue-guarantee": {
        // Issuing a guarantee is a financing decision — always routed through
        // the approval chain; the margin JE posts on approval.
        const { initiateApproval } = await import("@/lib/finance/approvals");
        const row = await issueBankGuarantee({ ...input, userId, pendingApproval: true });
        const approval = await initiateApproval({
          tenantSlug: input.tenantSlug,
          entityType: "bank_guarantee",
          entityId: String((row as any).id),
          requestedBy: userId ?? "system",
          entityData: {
            amount: Number(input.amount) || 0,
            reference: `Bank guarantee — ${input.bank} for ${input.beneficiary}`,
            requestedByName: (_scope as any).user?.name ?? userId,
          },
        });
        data = row;
        pendingApproval = { approvalId: approval.id };
        break;
      }
      case "update-guarantee": data = await updateBankGuaranteeStatus(input); break;
      case "sanction-discounting": {
        // Borrowing against a receivable — always routed through the
        // approval chain; the disbursement JE posts on approval.
        const { initiateApproval } = await import("@/lib/finance/approvals");
        const row = await sanctionInvoiceDiscounting({ ...input, userId, pendingApproval: true });
        const approval = await initiateApproval({
          tenantSlug: input.tenantSlug,
          entityType: "invoice_discounting",
          entityId: String((row as any).id),
          requestedBy: userId ?? "system",
          entityData: {
            amount: Number(input.loanAmount) || 0,
            reference: `Invoice discounting — ${input.bank}`,
            requestedByName: (_scope as any).user?.name ?? userId,
          },
        });
        data = row;
        pendingApproval = { approvalId: approval.id };
        break;
      }
      case "settle-discounting": data = await settleInvoiceDiscounting({ ...input, userId }); break;
      case "upsert-plan": data = await upsertSubscriptionPlan(input); break;
      case "create-subscription": data = await createSubscription(input); break;
      case "generate-invoices": data = await withProcessLog("subscription-invoices", { tenantSlug: input.tenantSlug, params: input, userId }, () => generateSubscriptionInvoices({ ...input, userId })); break;
      case "fetch-rates": data = await withProcessLog("exchange-rate-fetch", { tenantSlug: input.tenantSlug, params: input, userId }, () => fetchAndStoreExchangeRates(input)); break;
    }
    return NextResponse.json({ success: true, data, pendingApproval });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status ?? 500 });
  }
}
