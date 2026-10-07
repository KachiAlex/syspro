export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listLeave, insertLeave, getLeaveBalance, DEFAULT_LEAVE_ENTITLEMENTS } from "@/lib/hr/db";
import { requireModuleAccess } from "@/lib/api-auth";
import { sql as SQL } from "@/lib/sql-client";

const listSchema = z.object({
  tenantSlug: z.string().min(1),
  employeeId: z.string().optional(),
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
  leaveType: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

const createSchema = z.object({
  tenantSlug: z.string().min(1),
  employeeId: z.string().min(1),
  employeeName: z.string().min(1),
  leaveType: z.enum(["annual", "sick", "personal", "maternity", "paternity", "unpaid"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(1),
});

export async function GET(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "people", "read");
    if (!_scope.ok) return _scope.response;

  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    tenantSlug: url.searchParams.get("tenantSlug") ?? undefined,
    employeeId: url.searchParams.get("employeeId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    leaveType: url.searchParams.get("leaveType") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const employeeId = url.searchParams.get("employeeId");
    if (employeeId) {
      const balance = await getLeaveBalance(parsed.data.tenantSlug, employeeId);
      return NextResponse.json(balance);
    }

    const requests = await listLeave(parsed.data);
    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Leave list failed", error);
    return NextResponse.json({ error: "Failed to load leave requests" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "people", "write");
    if (!_scope.ok) return _scope.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Reject requests that exceed the employee's tracked balance — mirrors the
  // portal check (unpaid is untracked; no balance row means uncapped).
  const { leaveType, startDate, endDate } = parsed.data;
  if (leaveType !== "unpaid") {
    const days =
      Math.round(
        (new Date(`${endDate}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) / 86400000
      ) + 1;
    const year = new Date(`${startDate}T00:00:00Z`).getUTCFullYear();
    try {
      const [bal] = await SQL`
        select entitled, used, pending, carried_over, entitlement_set from admin_leave_balances
        where tenant_slug = ${parsed.data.tenantSlug} and employee_id = ${parsed.data.employeeId}
          and leave_type = ${leaveType} and year = ${year}
        limit 1
      `;
      // Explicit overrides use the configured entitlement; implicit tracking
      // rows (and no row at all) fall back to the default.
      const entitled = bal?.entitlement_set
        ? Number(bal.entitled)
        : (DEFAULT_LEAVE_ENTITLEMENTS[leaveType] ?? 0);
      const remaining =
        entitled + Number(bal?.carried_over ?? 0) - Number(bal?.used ?? 0) - Number(bal?.pending ?? 0);
      if (days > remaining) {
        return NextResponse.json(
          { error: `Insufficient ${leaveType} leave balance: ${days} day(s) requested, ${remaining} remaining` },
          { status: 400 }
        );
      }
    } catch (e) {
      // balances table may not exist yet — treat as uncapped
    }
  }

  try {
    const requestRecord = await insertLeave(parsed.data);
    return NextResponse.json({ request: requestRecord }, { status: 201 });
  } catch (error) {
    console.error("Leave create failed", error);
    return NextResponse.json({ error: "Failed to submit leave request" }, { status: 500 });
  }
}
