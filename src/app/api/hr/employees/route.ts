import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listEmployees, insertEmployee, countEmployees, ensureHrTables, resolveOrCreateDepartment } from "@/lib/hr/db";
import { ensureAdminTables } from "@/lib/admin/db";
import { extractAuthContext } from "@/lib/auth-helper";
import { resolveDepartmentHeadContext } from "@/lib/tenant-admin/utils";
import { sql as SQL } from "@/lib/sql-client";
import { setEmployeePassword, generatePassword } from "@/lib/hr/auth";

const listSchema = z.object({
  tenantSlug: z.string().min(1),
  status: z.string().optional(),
  departmentId: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).optional(),
  offset: z.coerce.number().min(0).optional(),
});

const createSchema = z.object({
  tenantSlug: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  departmentId: z.string().optional(),
  departmentName: z.string().optional(),
  jobTitle: z.string().min(1),
  reportingManagerId: z.string().optional(),
  branchId: z.string().optional(),
  regionId: z.string().optional(),
  costCenter: z.string().optional(),
  hireDate: z.string().datetime().optional(),
  salary: z.number().nonnegative().optional(),
  employmentType: z.enum(["full-time", "part-time", "contract", "intern"]).optional(),
  status: z.enum(["active", "inactive", "on-leave", "terminated"]).optional(),
  role: z.enum(["staff", "hod", "admin", "executive"]).optional(),
  activatePortal: z.boolean().optional(),
  password: z.string().min(1).optional(),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  // Get tenantSlug from authenticated session, not from query params
  const auth = extractAuthContext(request);
  if (!auth.tenantSlug) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const parsed = listSchema.safeParse({
    tenantSlug: auth.tenantSlug,
    status: url.searchParams.get("status") ?? undefined,
    departmentId: url.searchParams.get("departmentId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await ensureAdminTables(SQL);
    await ensureHrTables(SQL);
    // Apply department head scoping
    const context = await resolveDepartmentHeadContext({
      tenantSlug: parsed.data.tenantSlug,
      userId: auth.userId || 'unknown',
      userRole: auth.userRole || 'user',
      userPermissions: auth.userPermissions || [],
    });
    if (context.managedDepartmentId && !parsed.data.departmentId) {
      parsed.data.departmentId = context.managedDepartmentId;
    }

    const [employees, total] = await Promise.all([
      listEmployees(parsed.data),
      countEmployees({ tenantSlug: parsed.data.tenantSlug, status: parsed.data.status, departmentId: parsed.data.departmentId }),
    ]);
    return NextResponse.json({ employees, total });
  } catch (error) {
    console.error("Employee list failed", error);
    return NextResponse.json({ error: "Failed to load employees" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = extractAuthContext(request);
  if (!auth.tenantSlug) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Override tenantSlug with the authenticated session's tenant
  const parsed = createSchema.safeParse({ ...body, tenantSlug: auth.tenantSlug });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await ensureAdminTables(SQL);
    await ensureHrTables(SQL);

    // Resolve department: accept either a UUID (departmentId) or a raw name (departmentName)
    let departmentId = parsed.data.departmentId;
    if (!departmentId && parsed.data.departmentName) {
      const dept = await resolveOrCreateDepartment(parsed.data.tenantSlug, parsed.data.departmentName);
      departmentId = dept.id;
    }
    if (!departmentId) {
      return NextResponse.json({ error: "Either departmentId or departmentName is required" }, { status: 400 });
    }

    const employee = await insertEmployee({ ...parsed.data, departmentId });

    let portalCredentials: { email: string; password: string } | null = null;
    if (parsed.data.activatePortal) {
      const password = parsed.data.password || generatePassword();
      await setEmployeePassword(parsed.data.tenantSlug, employee.id, password);
      portalCredentials = { email: employee.email, password };
    }

    return NextResponse.json({ employee, portalCredentials }, { status: 201 });
  } catch (error: any) {
    console.error("Employee create failed", error);
    const msg = error?.message || "";
    if (msg.includes("HOD role in this department") || msg.includes("already exists")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create employee" }, { status: 500 });
  }
}
