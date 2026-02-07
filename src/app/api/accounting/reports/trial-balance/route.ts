import { NextRequest, NextResponse } from "next/server";
import {
  getTrialBalance,
  getGeneralLedger,
} from "@/lib/accounting/db";

/**
 * GET /api/accounting/reports/trial-balance
 * Get trial balance for a specific period
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenantSlug");
    const periodId = url.searchParams.get("periodId");

    if (!tenantSlug || !periodId) {
      return NextResponse.json(
        { error: "tenantSlug and periodId are required" },
        { status: 400 }
      );
    }

    const trialBalance = await getTrialBalance(tenantSlug, periodId);

    return NextResponse.json({ data: trialBalance });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching trial balance:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
