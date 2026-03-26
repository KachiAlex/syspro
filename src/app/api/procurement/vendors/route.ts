import { NextRequest, NextResponse } from "next/server";

// Mock database
const mockVendors: Array<{
  id: string;
  tenantSlug: string;
  name: string;
  code: string;
  category: string;
  paymentTerms: string;
  status: "active" | "inactive";
  createdAt: string;
}> = [];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get("tenantSlug") || "default";
    const status = searchParams.get("status");
    const category = searchParams.get("category");

    let vendors = mockVendors.filter((v) => v.tenantSlug === tenantSlug);

    if (status) {
      vendors = vendors.filter((v) => v.status === status);
    }

    if (category) {
      vendors = vendors.filter((v) => v.category === category);
    }

    return NextResponse.json({ vendors });
  } catch (error) {
    console.error("Error fetching vendors:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendors", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantSlug, name, code, category, paymentTerms } = body;

    if (!name || !code || !category || !paymentTerms) {
      return NextResponse.json(
        { error: "Missing required fields: name, code, category, paymentTerms" },
        { status: 400 }
      );
    }

    // Check for duplicate code
    if (mockVendors.some((v) => v.code === code && v.tenantSlug === (tenantSlug || "default"))) {
      return NextResponse.json(
        { error: "Vendor with this code already exists" },
        { status: 409 }
      );
    }

    const vendor = {
      id: `vendor_${Date.now()}`,
      tenantSlug: tenantSlug || "default",
      name,
      code,
      category,
      paymentTerms,
      status: "active" as const,
      createdAt: new Date().toISOString(),
    };

    mockVendors.push(vendor);

    return NextResponse.json({ vendor }, { status: 201 });
  } catch (error) {
    console.error("Error creating vendor:", error);
    return NextResponse.json(
      { error: "Failed to create vendor", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
