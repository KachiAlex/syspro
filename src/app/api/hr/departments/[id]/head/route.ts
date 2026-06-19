import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  validateTenantContext,
  resolveDepartmentHeadContext,
} from "@/lib/tenant-admin/utils";
import {
  getDepartmentById,
  updateDepartmentHead,
  ensureDepartmentHeadRole,
  assignDepartmentHeadRole,
  revokeDepartmentHeadRole,
} from "@/lib/hr/db";
import { db } from "@/lib/sql-client";

const patchSchema = z.object({
  managerId: z.string().nullable(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const context = validateTenantContext(request, "write");
  await resolveDepartmentHeadContext(context);

  const id = params.id;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const dept = await getDepartmentById(id, context.tenantSlug);
    if (!dept) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    const roleId = await ensureDepartmentHeadRole(context.tenantSlug);

    // Revoke old head if exists
    if (dept.managerId && dept.managerId !== parsed.data.managerId) {
      await revokeDepartmentHeadRole(context.tenantSlug, dept.managerId, roleId);
    }

    // Assign new head if provided
    if (parsed.data.managerId) {
      const empRows = await db.sql<any>`
        select id from admin_employees
        where tenant_slug = ${context.tenantSlug} and id = ${parsed.data.managerId}
        limit 1
      `;
      if (!Array.isArray(empRows) || empRows.length === 0) {
        return NextResponse.json({ error: "Manager not found in tenant employees" }, { status: 400 });
      }
      await assignDepartmentHeadRole(context.tenantSlug, parsed.data.managerId, roleId);
    }

    const updated = await updateDepartmentHead(id, context.tenantSlug, parsed.data.managerId);
    return NextResponse.json({ department: updated });
  } catch (error) {
    console.error("Department head update failed", error);
    return NextResponse.json({ error: "Failed to update department head" }, { status: 500 });
  }
}
