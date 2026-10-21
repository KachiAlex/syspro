export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { getCatalog } from "@/lib/storefront/orders";

type Params = { params: Promise<{ tenant: string }> };

/** PUBLIC — storefront catalog keyed on the tenant slug in the URL. */
export async function GET(request: NextRequest, { params }: Params) {
  const { tenant } = await params;
  try {
    const { searchParams } = new URL(request.url);
    const products = await getCatalog(tenant, {
      category: searchParams.get("category") ?? undefined,
      q: searchParams.get("q") ?? undefined,
    });
    return NextResponse.json({ products });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
