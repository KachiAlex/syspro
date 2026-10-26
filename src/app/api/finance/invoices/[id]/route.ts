export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { financeInvoiceUpdateSchema } from "@/lib/finance/types";
import { updateFinanceInvoice, deleteFinanceInvoice } from "@/lib/finance/db";

import { requireRecordTenant, requireModuleAccess } from "@/lib/api-auth";
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const _scope = await requireModuleAccess(request, "finance", "write");
    if (!_scope.ok) return _scope.response;

  const params = await context.params;
  const _owned = await requireRecordTenant("finance_invoices", params.id, _scope.user);
  if (!_owned.ok) return _owned.response;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = financeInvoiceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const invoice = await updateFinanceInvoice(params.id, parsed.data, _scope.user.tenantSlug);
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    return NextResponse.json({ invoice });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Finance invoice update failed", errorMessage, error);
    const status = errorMessage.includes("cannot be edited") ? 409 : 500;
    return NextResponse.json({ error: "Failed to update invoice", details: errorMessage }, { status });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const _scope = await requireModuleAccess(request, "finance", "write");
    if (!_scope.ok) return _scope.response;

  const params = await context.params;
  const _owned = await requireRecordTenant("finance_invoices", params.id, _scope.user);
  if (!_owned.ok) return _owned.response;
  const tenantSlug = _scope.user.tenantSlug ?? "";
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  try {
    // Deleting a sales invoice is destructive — it always routes through
    // the approvals engine unless a sales-matrix band auto-approves.
    const { db } = await import("@/lib/sql-client");
    const inv = (await db.query(
      `select invoice_number, amount from finance_invoices where id = $1 and tenant_slug = $2 limit 1`,
      [params.id, tenantSlug]
    )).rows[0];
    const { gateOrRun } = await import("@/lib/finance/gated-actions");
    const outcome = await gateOrRun(
      tenantSlug,
      "invoice_delete",
      { invoiceId: params.id, invoiceNumber: inv?.invoice_number, total: inv?.amount },
      { requestedBy: _scope.user.id ?? "unknown" }
    );
    if (outcome.status === "pending") {
      return NextResponse.json(
        { message: "Deletion submitted for approval", pendingApproval: true, approvalId: outcome.approvalId },
        { status: 202 }
      );
    }
    if (outcome.status === "denied") {
      return NextResponse.json({ error: outcome.error }, { status: 403 });
    }
    if (!outcome.result) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Invoice deleted" }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Finance invoice delete failed", errorMessage, error);
    const status = errorMessage.includes("cannot be deleted") ? 409 : 500;
    return NextResponse.json({ error: "Failed to delete invoice", details: errorMessage }, { status });
  }
}
