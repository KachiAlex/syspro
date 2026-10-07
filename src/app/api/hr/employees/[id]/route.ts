export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateEmployee, deleteEmployee, getEmployeeById, resolveOrCreateDepartment, employeeDependencies } from "@/lib/hr/db";
import { requireModuleAccess } from "@/lib/api-auth";

const updateSchema = z.object({
  tenantSlug: z.string().optional(),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  departmentId: z.string().min(1).optional(),
  departmentName: z.string().optional(),
  jobTitle: z.string().min(1).optional(),
  reportingManagerId: z.string().optional(),
  branchId: z.string().optional(),
  regionId: z.string().optional(),
  costCenter: z.string().optional(),
  hireDate: z.string().datetime().optional(),
  salary: z.number().nonnegative().optional(),
  employmentType: z.enum(["full-time", "part-time", "contract", "intern"]).optional(),
  workMode: z.enum(["ONSITE", "REMOTE", "HYBRID", "FIELD"]).optional(),
  status: z.enum(["active", "inactive", "on-leave", "terminated"]).optional(),
  role: z.enum(["staff", "hod", "admin", "executive"]).optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankAccountName: z.string().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleAccess(request, "people", "read");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const tenantSlug = auth.user.tenantSlug ?? new URL(request.url).searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  try {
    const employee = await getEmployeeById(id, tenantSlug);
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    return NextResponse.json({ employee });
  } catch (error) {
    console.error("Employee get failed", error);
    return NextResponse.json({ error: "Failed to load employee" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleAccess(request, "people", "write");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Override tenantSlug with the authenticated session's tenant
  const parsed = updateSchema.safeParse({ ...body, tenantSlug: auth.user.tenantSlug ?? body.tenantSlug });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    // Resolve departmentName to departmentId if provided
    let updateData = { ...parsed.data };
    if (!updateData.departmentId && updateData.departmentName && updateData.tenantSlug) {
      const dept = await resolveOrCreateDepartment(updateData.tenantSlug, updateData.departmentName);
      updateData.departmentId = dept.id;
    }
    delete (updateData as any).departmentName;
    delete (updateData as any).tenantSlug;

    const employee = await updateEmployee(id, updateData, parsed.data.tenantSlug);
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    return NextResponse.json({ employee });
  } catch (error: any) {
    console.error("Employee update failed", error);
    const msg = error?.message || "";
    if (msg.includes("HOD role in this department")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to update employee" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleAccess(request, "people", "write");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const tenantSlug = auth.user.tenantSlug ?? new URL(request.url).searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  try {
    const deps = await employeeDependencies(id, tenantSlug);
    const total = Object.values(deps).reduce((a, b) => a + b, 0);
    const force = new URL(request.url).searchParams.get("force") === "true";
    if (total > 0 && !force) {
      return NextResponse.json(
        {
          error: "Employee has historical records — deleting would erase payroll/leave/attendance history. Start offboarding instead, or pass force=true to delete anyway.",
          dependencies: deps,
        },
        { status: 409 }
      );
    }
    await deleteEmployee(id, tenantSlug);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Employee delete failed", error);
    return NextResponse.json({ error: "Failed to delete employee" }, { status: 500 });
  }
}
