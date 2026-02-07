import { NextRequest, NextResponse } from "next/server";

// In-memory storage for project invoices
const invoices: Record<string, Array<{ id: string; projectId: string; invoiceNumber: string; amount: number; status: "draft" | "sent" | "paid"; dueDate: string }>> = {};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug") || "default";

  const tenantInvoices = invoices[tenantSlug] || [];
  return NextResponse.json({ invoices: tenantInvoices });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenantSlug = "default", projectId, amount, dueDate } = body;

  if (!projectId || !amount || !dueDate) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (!invoices[tenantSlug]) {
    invoices[tenantSlug] = [];
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

  invoices[tenantSlug].push(newInvoice);

  return NextResponse.json(
    { invoice: newInvoice, message: "Invoice created successfully" },
    { status: 201 }
  );
}
