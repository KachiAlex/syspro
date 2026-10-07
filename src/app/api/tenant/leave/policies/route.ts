export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ensureHrTables,
  getLeavePolicies,
  upsertLeavePolicy,
  DEFAULT_LEAVE_ENTITLEMENTS,
} from "@/lib/hr/db";
import {
  validateTenantContext,
  errorResponse,
  checkRateLimit,
  handleTenantAdminError,
} from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";

const policySchema = z.object({
  leaveType: z.string().min(1).max(50),
  entitledDays: z.number().min(0).max(400),
  carryoverCap: z.number().min(0).max(400).optional(),
  accrual: z.enum(["annual", "monthly", "immediate"]).optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  countryCode: z.string().max(8).nullish(),
});

/**
 * GET /api/tenant/leave/policies?year=YYYY
 * Active leave policies effective for the year, merged over global defaults.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = validateTenantContext(request, "read");
    const _gate1 = await requireModuleGate(request, "people", "read");
    if (_gate1) return _gate1;
    await ensureHrTables();
    const year = Number(request.nextUrl.searchParams.get("year")) || new Date().getUTCFullYear();
    const policies = await getLeavePolicies(ctx.tenantSlug, year);
    return NextResponse.json({
      year,
      policies: Object.values(policies),
      defaults: DEFAULT_LEAVE_ENTITLEMENTS,
    });
  } catch (error) {
    return handleTenantAdminError(error);
  }
}

/**
 * PUT /api/tenant/leave/policies
 * Body: { policies: [{ leaveType, entitledDays, carryoverCap?, accrual?, effectiveFrom?, countryCode? }] }
 * Each entry versions the tenant's policy for that leave type — the prior
 * active version is deactivated, the new one takes effect from effectiveFrom
 * (default: Jan 1 of the current year).
 */
export async function PUT(request: NextRequest) {
  try {
    const ctx = validateTenantContext(request, "write");
    const _gate2 = await requireModuleGate(request, "people", "write");
    if (_gate2) return _gate2;
    if (!checkRateLimit(`leave-pol-${ctx.tenantSlug}`, 30, 60000)) {
      return errorResponse("Too many requests", 429);
    }
    const body = await request.json().catch(() => null);
    const items = Array.isArray(body?.policies) ? body.policies : [];
    if (!items.length || items.length > 20) {
      return errorResponse("policies must be a non-empty array (max 20)", 400);
    }
    const parsed = items.map((p: any) => policySchema.safeParse(p));
    const bad = parsed.findIndex((p: any) => !p.success);
    if (bad >= 0) {
      return errorResponse(`Invalid policy at index ${bad}: ${JSON.stringify(parsed[bad].error?.flatten())}`, 400);
    }
    await ensureHrTables();
    const defaultEffective = `${new Date().getUTCFullYear()}-01-01`;
    const saved = [];
    for (const p of parsed) {
      const d = p.data!;
      saved.push(
        await upsertLeavePolicy({
          tenantSlug: ctx.tenantSlug,
          leaveType: d.leaveType.toLowerCase(),
          entitledDays: d.entitledDays,
          carryoverCap: d.carryoverCap,
          accrual: d.accrual,
          effectiveFrom: d.effectiveFrom ?? defaultEffective,
          countryCode: d.countryCode ?? null,
        })
      );
    }
    return NextResponse.json({ success: true, policies: saved });
  } catch (error) {
    return handleTenantAdminError(error);
  }
}
