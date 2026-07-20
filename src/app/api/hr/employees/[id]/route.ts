import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateEmployee, deleteEmployee, getEmployeeById, resolveOrCreateDepartment } from "@/lib/hr/db";
import { extractAuthContext } from "@/lib/auth-helper";

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
  status: z.enum(["active", "inactive", "on-leave", "terminated"]).optional(),
  role: z.enum(["staff", "hod", "admin", "executive"]).optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = extractAuthContext(request);
  if (!auth.tenantSlug) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const employee = await getEmployeeById(id, auth.tenantSlug);
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
  const { id } = await params;
  const auth = extractAuthContext(request);
  if (!auth.tenantSlug) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Override tenantSlug with the authenticated session's tenant
  const parsed = updateSchema.safeParse({ ...body, tenantSlug: auth.tenantSlug });
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

    const employee = await updateEmployee(id, updateData);
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
  const { id } = await params;
  const auth = extractAuthContext(request);
  if (!auth.tenantSlug) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    await deleteEmployee(id, auth.tenantSlug);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Employee delete failed", error);
    return NextResponse.json({ error: "Failed to delete employee" }, { status: 500 });
  }
}
