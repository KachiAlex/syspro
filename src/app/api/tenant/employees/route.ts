import { NextRequest, NextResponse } from "next/server";
import { ensureAdminTables, insertEmployee, getEmployees, updateEmployee, deleteEmployee } from "@/lib/admin/db";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { CreateEmployeeSchema, UpdateEmployeeSchema, safeParse } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "read");
    await ensureAdminTables();
    const employees = await getEmployees(tenantSlug);
    return NextResponse.json({ tenant: tenantSlug, employees });
  } catch (error) {
    console.error("Employee GET failed", error);
    const message = error instanceof Error ? error.message : "Unable to fetch employees";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "write");
    
    const body = await request.json().catch(() => ({}));
    const validation = safeParse(CreateEmployeeSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request", details: validation.error.flatten() }, { status: 400 });
    }

    await ensureAdminTables();
    const id = await insertEmployee({ tenantSlug, name: validation.data.name, email: validation.data.email, departmentId: validation.data.department, branchId: validation.data.branch, regionId: validation.data.region });
    return NextResponse.json({ employee: { id, tenantSlug, name: validation.data.name, email: validation.data.email, department: validation.data.department, branch: validation.data.branch, region: validation.data.region, status: "active", createdAt: new Date().toISOString() } }, { status: 201 });
  } catch (error) {
    console.error("Employee create failed", error);
    const message = error instanceof Error ? error.message : "Unable to create employee";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    const id = new URL(request.url).searchParams.get("id");
    requirePermission(auth.userRole, "write");
    
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    
    const body = await request.json().catch(() => ({}));
    const validation = safeParse(UpdateEmployeeSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request", details: validation.error.flatten() }, { status: 400 });
    }

    await ensureAdminTables();
    await updateEmployee(id, tenantSlug, { departmentId: validation.data.department, branchId: validation.data.branch, regionId: validation.data.region });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Employee patch failed", error);
    const message = error instanceof Error ? error.message : "Unable to update employee";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    const id = new URL(request.url).searchParams.get("id");
    requirePermission(auth.userRole, "delete");
    
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await ensureAdminTables();
    await deleteEmployee(id, tenantSlug);
    return NextResponse.json({ message: "deleted" }, { status: 200 });
  } catch (error) {
    console.error("Employee delete failed", error);
    const message = error instanceof Error ? error.message : "Unable to delete employee";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
