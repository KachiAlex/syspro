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

    await ensureAdminTables();
    const id = await insertAccessControl({ tenantSlug, roleId: `role-${Date.now()}`, roleName: validation.data.roleName, moduleAccess: validation.data.moduleAccess });
    return NextResponse.json({ accessControl: { id, tenantSlug, roleId: `role-${Date.now()}`, roleName: validation.data.roleName, moduleAccess: validation.data.moduleAccess, tempGrants: [], createdAt: new Date().toISOString() } }, { status: 201 });
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

    await ensureAdminTables();
    await updateAccessControl(id, tenantSlug, validation.data);
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

    const updated: Partial<typeof ACCESS_CONTROLS[number]> = {};
    if (Array.isArray(body?.moduleAccess)) {
      updated.moduleAccess = body.moduleAccess.map((m: any) => ({
        module: String(m?.module),
        read: Boolean(m?.read),
        write: Boolean(m?.write),
        admin: Boolean(m?.admin),
      }));
    }

    ACCESS_CONTROLS[index] = { ...ACCESS_CONTROLS[index], ...updated };
    return NextResponse.json({ accessControl: ACCESS_CONTROLS[index] });
  } catch (error) {
    console.error("Access control patch failed", error);
    return NextResponse.json({ error: "Unable to update access control" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+/g, "/");
    const segments = path.split("/").filter(Boolean);
    const id = segments[segments.length - 1];
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const before = ACCESS_CONTROLS.length;
    ACCESS_CONTROLS = ACCESS_CONTROLS.filter((a) => a.id !== id);
    if (ACCESS_CONTROLS.length === before) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ message: "deleted" }, { status: 200 });
  } catch (error) {
    console.error("Access control delete failed", error);
    return NextResponse.json({ error: "Unable to delete access control" }, { status: 500 });
  }
}
