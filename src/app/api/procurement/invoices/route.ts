import { NextRequest, NextResponse } from "next/server";

// Mock database
const mockInvoices: Array<{
  id: string;
  tenantSlug: string;
  invoiceNumber: string;
  vendorId: string;
  poId: string;
  amount: number;
  dueDate: string;
  status: "received" | "verified" | "approved" | "paid" | "disputed";
  createdAt: string;
}> = [];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get("tenantSlug") || "default";
    const vendorId = searchParams.get("vendorId");
    const status = searchParams.get("status");

    let invoices = mockInvoices.filter((i) => i.tenantSlug === tenantSlug);

    if (vendorId) {
      invoices = invoices.filter((i) => i.vendorId === vendorId);
    }

    if (status) {
      invoices = invoices.filter((i) => i.status === status);
    }

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantSlug, vendorId, poId, amount, dueDate } = body;

    if (!vendorId || !poId || !amount || !dueDate) {
      return NextResponse.json(
        { error: "Missing required fields: vendorId, poId, amount, dueDate" },
        { status: 400 }
      );
    }

    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    const invoice = {
      id: `inv_${Date.now()}`,
      tenantSlug: tenantSlug || "default",
      invoiceNumber,
      vendorId,
      poId,
      amount: parseFloat(amount),
      dueDate,
      status: "received" as const,
      createdAt: new Date().toISOString(),
    };

    mockInvoices.push(invoice);

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error("Error creating invoice:", error);
    return NextResponse.json(
      { error: "Failed to create invoice", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
