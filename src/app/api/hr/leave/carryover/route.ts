export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import { runLeaveCarryover } from "@/lib/hr/db";

/**
 * POST /api/hr/leave/carryover?year=2025
 * Rolls unused leave into next year's carried_over, capped per policy.
 */
export async function POST(request: NextRequest) {
  const gate = await requireModuleAccess(request, "people", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const year = Number(new URL(request.url).searchParams.get("year"))
    || new Date().getUTCFullYear() - 1;
  const result = await runLeaveCarryover(context.tenantSlug, year);
  return NextResponse.json({ year, ...result });
}
