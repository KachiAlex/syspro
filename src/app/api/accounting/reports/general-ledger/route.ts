import { NextRequest, NextResponse } from "next/server";
import {
  getGeneralLedger,
} from "@/lib/accounting/db";

/**
 * GET /api/accounting/reports/general-ledger
 * Get general ledger for a specific account
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenantSlug");
    const accountId = url.searchParams.get("accountId");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    if (!tenantSlug || !accountId) {
      return NextResponse.json(
        { error: "tenantSlug and accountId are required" },
        { status: 400 }
      );
    }

    const ledger = await getGeneralLedger(tenantSlug, accountId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    return NextResponse.json({ data: ledger });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching general ledger:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
