import { NextRequest, NextResponse } from "next/server";
import { sql as SQL } from "@/lib/sql-client";

export async function GET(request: NextRequest) {
  try {
    const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");
    if (!tenantSlug) {
      return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
    }

    const method = request.nextUrl.searchParams.get("method") ?? "weighted_average";
    const sql = SQL;

    const rows = (await sql`
      select sku, name, category, current_stock, unit_cost, sale_price
      from inventory_products
      where tenant_slug = ${tenantSlug}
      order by category, name
    `) as any[];

    let totalValue = 0;
    const items = rows.map((row) => {
      const stock = Number(row.current_stock ?? 0);
      const unitCost = Number(row.unit_cost ?? 0);
      const value = stock * unitCost;
      totalValue += value;
      return {
        sku: row.sku,
        name: row.name,
        category: row.category,
        quantity: stock,
        unitCost,
        totalValue: value,
        salePrice: Number(row.sale_price ?? 0),
        potentialRevenue: stock * Number(row.sale_price ?? 0),
      };
    });

    const categoryTotals = items.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = { category: item.category, totalValue: 0, itemCount: 0, totalQuantity: 0 };
      acc[item.category].totalValue += item.totalValue;
      acc[item.category].itemCount += 1;
      acc[item.category].totalQuantity += item.quantity;
      return acc;
    }, {} as Record<string, { category: string; totalValue: number; itemCount: number; totalQuantity: number }>);

    return NextResponse.json({
      success: true,
      data: {
        method,
        totalValue,
        totalItems: items.length,
        totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
        items,
        categoryBreakdown: Object.values(categoryTotals).sort((a, b) => b.totalValue - a.totalValue),
      },
    });
  } catch (error) {
    console.error("Error generating inventory valuation:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
