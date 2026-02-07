import { NextRequest, NextResponse } from "next/server";
import { ensureAdminTables, insertDepartment, getDepartments, deleteDepartment } from "@/lib/admin/db";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { CreateDepartmentSchema, safeParse } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "read");
    await ensureAdminTables();
    const departments = await getDepartments(tenantSlug);
    return NextResponse.json({ tenant: tenantSlug, departments });
  } catch (error) {
    console.error("Department GET failed", error);
    const message = error instanceof Error ? error.message : "Unable to fetch departments";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "write");
    
    const body = await request.json().catch(() => ({}));
    const validation = safeParse(CreateDepartmentSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request", details: validation.error.flatten() }, { status: 400 });
    }

    await ensureAdminTables();
    const id = await insertDepartment({ tenantSlug, name: validation.data.name, description: validation.data.description });
    return NextResponse.json({ department: { id, tenantSlug, name: validation.data.name, description: validation.data.description, createdAt: new Date().toISOString() } }, { status: 201 });
  } catch (error) {
    console.error("Department create failed", error);
    const message = error instanceof Error ? error.message : "Unable to create department";
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
    await deleteDepartment(id, tenantSlug);
    return NextResponse.json({ message: "deleted" }, { status: 200 });
  } catch (error) {
    console.error("Department delete failed", error);
    const message = error instanceof Error ? error.message : "Unable to delete department";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
