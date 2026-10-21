export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  importOpeningBalances,
  unreconcileCustomerPayment,
  unreconcileVendorPayment,
  createPaymentOrder,
  processPaymentOrder,
  listPaymentOrders,
  processStatementOfAccounts,
  upsertModeOfPayment,
  listModesOfPayment,
  upsertMonthlyDistribution,
  listMonthlyDistributions,
  upsertCostCenterAllocation,
  listCostCenterAllocations,
} from "@/lib/finance/erp-tools";
import { requireModuleAccess } from "@/lib/api-auth";
import { withProcessLog } from "@/lib/finance/process-log";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;
  const sp = request.nextUrl.searchParams;
  const tenantSlug = sp.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
  }
  const view = sp.get("view") ?? "payment-orders";
  switch (view) {
    case "payment-orders":
      return NextResponse.json({ success: true, data: await listPaymentOrders(tenantSlug) });
    case "modes":
      return NextResponse.json({ success: true, data: await listModesOfPayment(tenantSlug) });
    case "distributions":
      return NextResponse.json({ success: true, data: await listMonthlyDistributions(tenantSlug) });
    case "cc-allocations":
      return NextResponse.json({ success: true, data: await listCostCenterAllocations(tenantSlug) });
    default:
      return NextResponse.json({ success: false, error: `view must be one of: payment-orders, modes, distributions, cc-allocations` }, { status: 400 });
  }
}

const schemas = {
  "opening-import": z.object({
    tenantSlug: z.string().min(1),
    postingDate: z.string().min(8),
    invoices: z.array(z.object({
      customerCode: z.string().min(1),
      customerName: z.string().optional(),
      invoiceNumber: z.string().optional(),
      dueDate: z.string().optional(),
      amount: z.coerce.number().positive(),
      description: z.string().optional(),
    })).optional(),
    bills: z.array(z.object({
      vendorCode: z.string().optional(),
      vendorName: z.string().optional(),
      billNumber: z.string().optional(),
      dueDate: z.string().optional(),
      amount: z.coerce.number().positive(),
      description: z.string().optional(),
    })).optional(),
  }),
  "unreconcile-customer": z.object({
    tenantSlug: z.string().min(1),
    paymentId: z.string().min(1),
    invoiceId: z.string().optional(),
  }),
  "unreconcile-vendor": z.object({
    tenantSlug: z.string().min(1),
    paymentId: z.string().min(1),
    billId: z.string().optional(),
  }),
  "create-payment-order": z.object({
    tenantSlug: z.string().min(1),
    name: z.string().min(1),
    paymentDate: z.string().min(8),
    method: z.string().optional(),
    bankAccountCode: z.string().optional(),
    items: z.array(z.object({ billId: z.string().min(1), amount: z.coerce.number().positive().optional() })).min(1),
  }),
  "process-payment-order": z.object({
    tenantSlug: z.string().min(1),
    paymentOrderId: z.string().min(1),
  }),
  "statement-run": z.object({
    tenantSlug: z.string().min(1),
    periodStart: z.string().optional(),
    periodEnd: z.string().optional(),
    email: z.boolean().optional(),
  }),
  "upsert-mop": z.object({
    tenantSlug: z.string().min(1),
    name: z.string().min(1),
    type: z.string().optional(),
    defaultAccountCode: z.string().optional(),
    enabled: z.boolean().optional(),
  }),
  "upsert-distribution": z.object({
    tenantSlug: z.string().min(1),
    name: z.string().min(1),
    percentages: z.array(z.coerce.number()).length(12),
  }),
  "upsert-cc-allocation": z.object({
    tenantSlug: z.string().min(1),
    mainCostCenter: z.string().min(1),
    allocations: z.array(z.object({
      costCenterId: z.string().min(1),
      percentage: z.coerce.number().positive(),
    })).min(1),
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
    const userId = (_scope as any).user?.id;
    const logged = (process: string, fn: () => Promise<unknown>) =>
      withProcessLog(process, { tenantSlug: input.tenantSlug, params: input, userId }, fn);
    let data: unknown;
    switch (action) {
      case "opening-import": data = await logged("opening-import", () => importOpeningBalances({ ...input, userId })); break;
      case "unreconcile-customer": data = await unreconcileCustomerPayment(input); break;
      case "unreconcile-vendor": data = await unreconcileVendorPayment(input); break;
      case "create-payment-order": data = await createPaymentOrder({ ...input, userId }); break;
      case "process-payment-order": data = await logged("payment-order", () => processPaymentOrder({ ...input, userId })); break;
      case "statement-run": data = await logged("statement-of-accounts", () => processStatementOfAccounts({ ...input, userId })); break;
      case "upsert-mop": data = await upsertModeOfPayment(input); break;
      case "upsert-distribution": data = await upsertMonthlyDistribution(input); break;
      case "upsert-cc-allocation": data = await upsertCostCenterAllocation(input); break;
    }
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status ?? 500 });
  }
}
