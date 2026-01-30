import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { FINANCE_INVOICE_STATUSES, financeInvoiceCreateSchema } from "@/lib/finance/types";
import { insertFinanceInvoice, listFinanceInvoices } from "@/lib/finance/db";

const invoiceListSchema = z.object({
  tenantSlug: z.string().min(1),
  status: z.enum(FINANCE_INVOICE_STATUSES).optional(),
  regionId: z.string().optional(),
  branchId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = invoiceListSchema.safeParse({
    tenantSlug: url.searchParams.get("tenantSlug") ?? undefined,
    status: (url.searchParams.get("status") ?? undefined) as z.infer<typeof invoiceListSchema>["status"],
    regionId: url.searchParams.get("regionId") ?? undefined,
    branchId: url.searchParams.get("branchId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const invoices = await listFinanceInvoices(parsed.data);
    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("Finance invoices list failed", error);
    return NextResponse.json({ error: "Failed to load invoices" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = financeInvoiceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const invoice = await insertFinanceInvoice(parsed.data);
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error("Finance invoice create failed", error);
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
  }
}
