export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import {
  validateTenantContext,
  errorResponse,
  handleTenantAdminError,
} from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";

function mapComponent(r: any) {
  return {
    id: r.id,
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    name: r.name,
    componentType: r.component_type,
    amountType: r.amount_type,
    amount: Number(r.amount) || 0,
    isRecurring: r.is_recurring,
    isActive: r.is_active,
    startPeriod: r.start_period,
    endPeriod: r.end_period,
  };
}

/**
 * PATCH /api/tenant/payroll/components/[id]
 * Update amount, activation, or period bounds of a salary component.
 */
export async function PATCH(request: NextRequest, context: any) {
  try {
    const ctx = validateTenantContext(request, "write");
    const _gate1 = await requireModuleGate(request, "people", "write");
    if (_gate1) return _gate1;
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    await ensureHrTables(sql);

    const amount = typeof body?.amount === "number" ? body.amount : null;
    if (amount !== null && amount < 0) {
      return errorResponse("amount must be >= 0", 400);
    }
    const isActive = typeof body?.isActive === "boolean" ? body.isActive : null;
    const endPeriod = typeof body?.endPeriod === "string" ? body.endPeriod : null;

    const [row] = await sql`
      update admin_employee_components set
        amount = coalesce(${amount}, amount),
        is_active = coalesce(${isActive}, is_active),
        end_period = coalesce(${endPeriod}, end_period),
        notes = coalesce(${body?.notes ?? null}, notes),
        updated_at = now()
      where id = ${id} and tenant_slug = ${ctx.tenantSlug}
      returning *
    `;

    if (!row) {
      return errorResponse("Component not found", 404);
    }
    return NextResponse.json({ success: true, data: mapComponent(row) });
  } catch (error) {
    console.error("Payroll component PATCH error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * DELETE /api/tenant/payroll/components/[id]
 */
export async function DELETE(request: NextRequest, context: any) {
  try {
    const ctx = validateTenantContext(request, "write");
    const _gate2 = await requireModuleGate(request, "people", "write");
    if (_gate2) return _gate2;
    const { id } = await context.params;

    await ensureHrTables(sql);
    const rows = await sql`
      delete from admin_employee_components
      where id = ${id} and tenant_slug = ${ctx.tenantSlug}
      returning id
    `;
    if (!(rows as any[]).length) {
      return errorResponse("Component not found", 404);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Payroll component DELETE error:", error);
    return handleTenantAdminError(error);
  }
}
