import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  return NextResponse.json({ invoices: [] });
}

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  const { projectId, amount, dueDate } = body;

  if (!projectId || !amount || !dueDate) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const invoiceNumber = `INV-${Date.now()}`;
  const newInvoice = {
    id: `inv-${Date.now()}`,
    projectId,
    invoiceNumber,
    amount: parseFloat(amount),
    status: "draft" as const,
    dueDate,
  };

  return NextResponse.json(
    { invoice: newInvoice, message: "Invoice created successfully" },
    { status: 201 }
  );
}
