import { NextRequest, NextResponse } from "next/server";

// Mock database - in production this would connect to your actual database
const mockProducts: Array<{
  id: string;
  tenantSlug: string;
  name: string;
  sku: string;
  category: string;
  currentStock: number;
  minStock: number;
  unitCost: number;
  createdAt: string;
}> = [];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get("tenantSlug") || "default";
    const category = searchParams.get("category");

    let products = mockProducts.filter((p) => p.tenantSlug === tenantSlug);

    if (category) {
      products = products.filter((p) => p.category === category);
    }

    return NextResponse.json({ products });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantSlug, name, sku, category, currentStock, minStock, unitCost } = body;

    if (!name || !sku || !category) {
      return NextResponse.json(
        { error: "Missing required fields: name, sku, category" },
        { status: 400 }
      );
    }

    const product = {
      id: `prod_${Date.now()}`,
      tenantSlug: tenantSlug || "default",
      name,
      sku,
      category,
      currentStock: currentStock || 0,
      minStock: minStock || 0,
      unitCost: unitCost || 0,
      createdAt: new Date().toISOString(),
    };

    mockProducts.push(product);

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json(
      { error: "Failed to create product", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
