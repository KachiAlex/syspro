import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listEmployees, insertEmployee, countEmployees } from "@/lib/hr/db";
import { extractAuthContext } from "@/lib/auth-helper";
import { resolveDepartmentHeadContext } from "@/lib/tenant-admin/utils";

const listSchema = z.object({
  tenantSlug: z.string().min(1),
  status: z.string().optional(),
  departmentId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

const createSchema = z.object({
  tenantSlug: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  departmentId: z.string().min(1),
  jobTitle: z.string().min(1),
  reportingManagerId: z.string().optional(),
  branchId: z.string().optional(),
  regionId: z.string().optional(),
  costCenter: z.string().optional(),
  hireDate: z.string().datetime().optional(),
  salary: z.number().nonnegative().optional(),
  employmentType: z.enum(["full-time", "part-time", "contract", "intern"]).optional(),
  status: z.enum(["active", "inactive", "on-leave", "terminated"]).optional(),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    tenantSlug: url.searchParams.get("tenantSlug") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    departmentId: url.searchParams.get("departmentId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    // Apply department head scoping
    const auth = extractAuthContext(request);
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
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const employee = await insertEmployee(parsed.data);
    return NextResponse.json({ employee }, { status: 201 });
  } catch (error) {
    console.error("Employee create failed", error);
    return NextResponse.json({ error: "Failed to create employee" }, { status: 500 });
  }
}
