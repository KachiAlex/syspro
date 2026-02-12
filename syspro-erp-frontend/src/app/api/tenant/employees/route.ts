import { NextRequest, NextResponse } from "next/server";
import { ensureAdminTables, insertEmployee, getEmployees, updateEmployee, deleteEmployee } from "@/lib/admin/db";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { CreateEmployeeSchema, UpdateEmployeeSchema, safeParse } from "@/lib/validation";
import { enforcePermission } from "@/lib/api-permission-enforcer";

// Helper to get tenantSlug from request
function getTenantSlug(request: NextRequest): string {
  return new URL(request.url).searchParams.get("tenantSlug") || "kreatix-default";
}

export async function GET(request: NextRequest) {
  try {
    const tenantSlug = getTenantSlug(request);
    
    // Enforce read permission on people module
    const check = await enforcePermission(request, "people", "read", tenantSlug);
    if (!check.allowed) {
      return check.response;
    }

    await ensureAdminTables();
    const employees = await getEmployees(tenantSlug);
    return NextResponse.json({ tenant: tenantSlug, employees });
  } catch (error) {
    console.error("Employee GET failed", error);
    const message = error instanceof Error ? error.message : "Unable to fetch employees";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantSlug = getTenantSlug(request);
    
    // Enforce write permission on people module
    const check = await enforcePermission(request, "people", "write", tenantSlug);
    if (!check.allowed) {
      return check.response;
    }
    
    const body = await request.json().catch(() => ({}));
    const validation = safeParse(CreateEmployeeSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request", details: validation.error.flatten() }, { status: 400 });
    }

    await ensureAdminTables();
    const data = validation.data;
    const id = await insertEmployee({
      tenantSlug,
      name: data.name,
      email: data.email,
      departmentId: data.department,
      branchId: data.branch,
      regionId: data.region,
    });
    return NextResponse.json({
      employee: {
        id,
        tenantSlug,
        name: data.name,
        email: data.email,
        department: data.department,
        branch: data.branch,
        region: data.region,
        status: "active",
        createdAt: new Date().toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Employee create failed", error);
    const message = error instanceof Error ? error.message : "Unable to create employee";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const tenantSlug = getTenantSlug(request);
    const id = new URL(request.url).searchParams.get("id");
    
    // Enforce write permission on people module
    const check = await enforcePermission(request, "people", "write", tenantSlug);
    if (!check.allowed) {
      return check.response;
    }
    
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const tenantSlug = getTenantSlug(request);
    const id = new URL(request.url).searchParams.get("id");
    
    // Enforce admin permission on people module
    const check = await enforcePermission(request, "people", "admin", tenantSlug);
    if (!check.allowed) {
      return check.response;
    }
    
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await ensureAdminTables();
    await deleteEmployee(id, tenantSlug);
    return NextResponse.json({ message: "deleted" }, { status: 200 });
  } catch (error) {
    console.error("Employee delete failed", error);
    const message = error instanceof Error ? error.message : "Unable to delete employee";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
