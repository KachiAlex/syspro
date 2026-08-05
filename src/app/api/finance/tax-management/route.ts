import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createTaxRate,
  listTaxRates,
  createTaxReturn,
  listTaxReturns,
  fileTaxReturn,
  markTaxReturnPaid,
  listTaxTransactions,
  recordTaxTransaction,
} from "@/lib/finance/tax-management";

const taxRateSchema = z.object({
  tenantSlug: z.string().min(1),
  taxType: z.enum(["vat", "wht", "paye", "company_tax", "custom"]),
  name: z.string().min(1),
  rate: z.coerce.number().min(0).max(100),
  effectiveFrom: z.string().min(1),
  effectiveTo: z.string().optional(),
});

const taxReturnSchema = z.object({
  tenantSlug: z.string().min(1),
  taxType: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  notes: z.string().optional(),
});

const taxTransactionSchema = z.object({
  tenantSlug: z.string().min(1),
  transactionType: z.enum(["sales", "purchase", "wht_deducted", "wht_received", "vat_output", "vat_input"]),
  sourceType: z.enum(["invoice", "bill", "payment", "manual"]),
  sourceId: z.string().optional(),
  transactionDate: z.string().min(1),
  description: z.string().min(1),
  baseAmount: z.coerce.number(),
  taxRate: z.coerce.number(),
  taxAmount: z.coerce.number(),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantSlug = searchParams.get("tenantSlug");
    if (!tenantSlug) {
      return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
    }

    const resource = searchParams.get("resource") || "returns";

    if (resource === "rates") {
      const rates = await listTaxRates(tenantSlug);
      return NextResponse.json({ success: true, data: rates });
    }

    if (resource === "transactions") {
      const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50;
      const transactions = await listTaxTransactions(tenantSlug, limit);
      return NextResponse.json({ success: true, data: transactions });
    }

    const returns = await listTaxReturns(tenantSlug);
    return NextResponse.json({ success: true, data: returns });
  } catch (error) {
    console.error("Error fetching tax data:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action || "create_return";

    if (action === "create_rate") {
      const parsed = taxRateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
      }
      const rate = await createTaxRate(parsed.data);
      return NextResponse.json({ success: true, data: rate });
    }

    if (action === "record_transaction") {
      const parsed = taxTransactionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
      }
      const tx = await recordTaxTransaction(parsed.data);
      return NextResponse.json({ success: true, data: tx });
    }

    const parsed = taxReturnSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
    }
    const taxReturn = await createTaxReturn(parsed.data);
    return NextResponse.json({ success: true, data: taxReturn });
  } catch (error) {
    console.error("Error creating tax data:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const searchParams = request.nextUrl.searchParams;
    const tenantSlug = searchParams.get("tenantSlug");
    const id = searchParams.get("id");
    const action = body.action;

    if (!tenantSlug || !id) {
      return NextResponse.json({ success: false, error: "tenantSlug and id are required" }, { status: 400 });
    }

    if (action === "file") {
      const taxReturn = await fileTaxReturn(id, tenantSlug, body.reference || "");
      return NextResponse.json({ success: true, data: taxReturn });
    }

    if (action === "mark_paid") {
      const taxReturn = await markTaxReturnPaid(id, tenantSlug);
      return NextResponse.json({ success: true, data: taxReturn });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating tax return:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
