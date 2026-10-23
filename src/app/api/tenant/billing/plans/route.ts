export const dynamic = "force-dynamic";
/**
 * GET /api/tenant/billing/plans — active pricing plans for the upgrade modal.
 * Sourced from the pricing_plans table (managed via superadmin); falls back to
 * the built-in DEFAULT_PLANS in lib/pricing/plans.ts when unavailable.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireModuleGate } from "@/lib/api-auth";
import { getPricingPlans } from "@/lib/pricing/plans";

export async function GET(request: NextRequest) {
  const _gate = await requireModuleGate(request, "billing", "read");
  if (_gate) return _gate;

  try {
    const plans = await getPricingPlans();
    return NextResponse.json({ plans });
  } catch (error) {
    console.error("Failed to list pricing plans:", error);
    return NextResponse.json({ error: "Failed to fetch plans" }, { status: 500 });
  }
}
