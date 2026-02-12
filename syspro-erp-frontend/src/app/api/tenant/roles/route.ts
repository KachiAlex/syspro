import { NextRequest, NextResponse } from "next/server";
import { ensureAdminTables, insertRole, getRoles, updateRole, deleteRole } from "@/lib/admin/db";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { CreateRoleSchema, UpdateRoleSchema, safeParse } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "read");
    await ensureAdminTables();
    const roles = await getRoles(tenantSlug);
    return NextResponse.json({ tenant: tenantSlug, roles });
  } catch (error) {
    console.error("Role GET failed", error);
    const message = error instanceof Error ? error.message : "Unable to fetch roles";
    return NextResponse.json({ error: message }, { status: error instanceof Error && message.includes("Unauthorized") ? 403 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "write");
    
    const body = await request.json().catch(() => ({}));
    const validation = safeParse(CreateRoleSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request", details: validation.error.flatten() }, { status: 400 });
    }

    await ensureAdminTables();
    const data = validation.data;
    const id = await insertRole({ tenantSlug, name: data.name, scope: data.scope ?? "tenant", permissions: data.permissions ?? [] });
    return NextResponse.json({ role: { id, tenantSlug, name: data.name, scope: data.scope ?? "tenant", permissions: data.permissions ?? [], createdAt: new Date().toISOString() } }, { status: 201 });
  } catch (error) {
    console.error("Role create failed", error);
    const message = error instanceof Error ? error.message : "Unable to create role";
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
    const validation = safeParse(UpdateRoleSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request", details: validation.error.flatten() }, { status: 400 });
    }

    await ensureAdminTables();
    const data = validation.data;
    await updateRole(id, tenantSlug, data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Role patch failed", error);
    const message = error instanceof Error ? error.message : "Unable to update role";
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
    await deleteRole(id, tenantSlug);
    return NextResponse.json({ message: "deleted" }, { status: 200 });
  } catch (error) {
    console.error("Role delete failed", error);
    const message = error instanceof Error ? error.message : "Unable to delete role";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
