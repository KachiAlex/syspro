import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { getProjectInvoices, createProjectInvoice } from "@/lib/projects/db";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const rawInvoices = await getProjectInvoices(context.tenantSlug);
  const invoices = rawInvoices.map((inv: any) => ({
    id: inv.id,
    projectId: inv.project_id,
    invoiceNumber: inv.invoice_number,
    amount: Number(inv.amount),
    status: inv.status,
    dueDate: inv.due_date,
  }));
  return NextResponse.json({ invoices });
}

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  const { projectId, amount, dueDate } = body;

  if (!projectId || amount === undefined || amount === null || !dueDate) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const invoice = await createProjectInvoice(
    context.tenantSlug,
    { projectId, amount: parseFloat(amount), dueDate },
    context.userId
  );

  if (!invoice) {
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
  }

  return NextResponse.json(
    { invoice, message: "Invoice created successfully" },
    { status: 201 }
  );
}
