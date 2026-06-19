import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listDepartments, insertDepartment, ensureDepartmentHeadRole, assignDepartmentHeadRole, listDepartmentsWithHeads, getDepartmentEmployeeCount } from "@/lib/hr/db";
import { db } from "@/lib/sql-client";

const listSchema = z.object({
  tenantSlug: z.string().min(1),
});

const createSchema = z.object({
  tenantSlug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  parentDepartmentId: z.string().optional(),
  budget: z.number().nonnegative().optional(),
  costCenter: z.string().optional(),
  managerId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    tenantSlug: url.searchParams.get("tenantSlug") ?? undefined,
  });
  const withHeads = url.searchParams.get("withHeads") === "true";

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    if (withHeads) {
      const departments = await listDepartmentsWithHeads(parsed.data.tenantSlug);
      const withCounts = await Promise.all(
        departments.map(async (d) => ({
          ...d,
          employeeCount: await getDepartmentEmployeeCount(parsed.data.tenantSlug, d.id),
        }))
      );
      return NextResponse.json({ departments: withCounts });
    }
    const departments = await listDepartments(parsed.data.tenantSlug);
    return NextResponse.json({ departments });
  } catch (error) {
    console.error("Department list failed", error);
    return NextResponse.json({ error: "Failed to load departments" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    // Validate managerId if provided
    if (parsed.data.managerId) {
      const users = await db.sql<any>`
        select u.id from users u
        join tenants t on u.tenant_id = t.id
        where t.slug = ${parsed.data.tenantSlug} and u.id = ${parsed.data.managerId} and u.status = 'active'
        limit 1
      `;
      if (!Array.isArray(users) || users.length === 0) {
        return NextResponse.json({ error: "Manager not found in tenant" }, { status: 400 });
      }
    }

    const department = await insertDepartment(parsed.data);

    // Auto-assign department head role if manager provided
    if (department.managerId) {
      const roleId = await ensureDepartmentHeadRole(parsed.data.tenantSlug);
      await assignDepartmentHeadRole(parsed.data.tenantSlug, department.managerId, roleId);
    }

    return NextResponse.json({ department }, { status: 201 });
  } catch (error) {
    console.error("Department create failed", error);
    return NextResponse.json({ error: "Failed to create department" }, { status: 500 });
  }
}
