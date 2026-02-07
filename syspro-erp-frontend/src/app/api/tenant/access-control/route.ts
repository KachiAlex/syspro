import { NextRequest, NextResponse } from "next/server";
import { ensureAdminTables, insertAccessControl, getAccessControls, updateAccessControl, deleteAccessControl } from "@/lib/admin/db";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { CreateAccessControlSchema, UpdateAccessControlSchema, safeParse } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "read");
    await ensureAdminTables();
    const accessControls = await getAccessControls(tenantSlug);
    return NextResponse.json({ tenant: tenantSlug, accessControls });
  } catch (error) {
    console.error("Access control GET failed", error);
    const message = error instanceof Error ? error.message : "Unable to fetch access controls";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "write");
    
    const body = await request.json().catch(() => ({}));
    const validation = safeParse(CreateAccessControlSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request", details: validation.error.flatten() }, { status: 400 });
    }

    // Cast validated data to a known shape to satisfy TypeScript
    const parsed = validation.data as { roleName: string; moduleAccess: unknown[] };

    await ensureAdminTables();
    const roleId = `role-${Date.now()}`;
    const id = await insertAccessControl({ tenantSlug, roleId, roleName: parsed.roleName, moduleAccess: parsed.moduleAccess });
    return NextResponse.json({ accessControl: { id, tenantSlug, roleId, roleName: parsed.roleName, moduleAccess: parsed.moduleAccess, tempGrants: [], createdAt: new Date().toISOString() } }, { status: 201 });
  } catch (error) {
    console.error("Access control create failed", error);
    const message = error instanceof Error ? error.message : "Unable to create access control";
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
    const validation = safeParse(UpdateAccessControlSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request", details: validation.error.flatten() }, { status: 400 });
    }

    // validation.data is unknown; cast to expected shape for update
    const updateData = validation.data as { roleName?: string; moduleAccess?: unknown[] };

    await ensureAdminTables();
    await updateAccessControl(id, tenantSlug, updateData);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Access control patch failed", error);
    const message = error instanceof Error ? error.message : "Unable to update access control";
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
    await deleteAccessControl(id, tenantSlug);
    return NextResponse.json({ message: "deleted" }, { status: 200 });
  } catch (error) {
    console.error("Access control delete failed", error);
    const message = error instanceof Error ? error.message : "Unable to delete access control";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
