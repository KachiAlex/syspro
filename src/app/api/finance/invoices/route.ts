export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { FINANCE_INVOICE_STATUSES, financeInvoiceCreateSchema } from "@/lib/finance/types";
import { insertFinanceInvoice, listFinanceInvoices } from "@/lib/finance/db";
import { writeFinanceEvent } from "@/lib/finance/events";
import { getCurrentUser } from "@/lib/auth-helpers";
import { requireModuleGate, requireDocGate } from "@/lib/api-auth";

const invoiceListSchema = z.object({
  tenantSlug: z.string().min(1),
  status: z.enum(FINANCE_INVOICE_STATUSES).optional(),
  regionId: z.string().optional(),
  branchId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function GET(request: NextRequest) {
  const gate = await requireModuleGate(request, "finance", "read");
  if (gate) return gate;
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
  const gate = await requireDocGate(request, "invoice", "submit", "finance", "write");
  if (gate) return gate;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = financeInvoiceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    // Creating an invoice already in an issued state posts AR, so it takes
    // the same invoice_issue gate as a PATCH draft→issued: insert as draft,
    // then issue through the gate.
    const { status, tenantSlug } = parsed.data;
    const issueNow = status !== "draft" && status !== "void";
    const created = await insertFinanceInvoice(issueNow ? { ...parsed.data, status: "draft" } : parsed.data);
    let invoice = created;
    if (issueNow) {
      const { gateOrRun } = await import("@/lib/finance/gated-actions");
      const outcome = await gateOrRun(
        tenantSlug,
        "invoice_issue",
        { invoiceId: created.id, invoiceNumber: created.invoiceNumber, total: created.amount, updates: { status } },
        { requestedBy: getCurrentUser(request)?.id ?? "unknown" }
      );
      if (outcome.status === "pending") {
        return NextResponse.json(
          { invoice: created, pendingApproval: true, approvalId: outcome.approvalId },
          { status: 202 }
        );
      }
      if (outcome.status === "denied") {
        return NextResponse.json({ error: outcome.error }, { status: 403 });
      }
      invoice = outcome.result;
    }

    // Publish finance event for reporting
    writeFinanceEvent({
      tenantSlug: parsed.data.tenantSlug,
      eventType: "invoice_issued",
      sourceModule: "finance",
      sourceRecordId: invoice.id,
      userId: getCurrentUser(request)?.id,
      amount: invoice.amount,
      currency: invoice.currency,
      metadata: { invoiceNumber: invoice.invoiceNumber, customerName: invoice.customerName },
    });

    try {
      const { emitEvent } = await import("@/lib/notify");
      void emitEvent({
        tenantSlug: parsed.data.tenantSlug,
        eventType: "invoice.issued",
        sourceModule: "finance",
        sourceRecordId: invoice.id,
        actorId: getCurrentUser(request)?.id,
        payload: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customerName: invoice.customerName,
          customerId: invoice.customerId,
          customerCode: invoice.customerCode,
          partyEmail: invoice.customerEmail,
          amount: invoice.amount,
          dueDate: invoice.dueDate,
        },
      });
    } catch (err) {
      console.error("Failed to emit invoice.issued:", err);
    }

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Finance invoice create failed", errorMessage, error);
    return NextResponse.json({ error: "Failed to create invoice", details: errorMessage }, { status: 500 });
  }
}
