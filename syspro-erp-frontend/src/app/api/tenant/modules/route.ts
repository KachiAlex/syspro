import { NextRequest, NextResponse } from "next/server";
import { ensureAdminTables, insertModule, getModules, updateModule, deleteModule } from "@/lib/admin/db";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { CreateModuleSchema, UpdateModuleSchema, safeParse } from "@/lib/validation";
import { enforcePermission } from "@/lib/api-permission-enforcer";

// Helper to get tenantSlug from request
function getTenantSlug(request: NextRequest): string {
  return new URL(request.url).searchParams.get("tenantSlug") || "kreatix-default";
}

export async function GET(request: NextRequest) {
  try {
    const tenantSlug = getTenantSlug(request);
    
    // Enforce read permission on admin module
    const check = await enforcePermission(request, "admin", "read", tenantSlug);
    if (!check.allowed) {
      return check.response;
    }

    await ensureAdminTables();
    const modules = await getModules(tenantSlug);
    return NextResponse.json({ tenant: tenantSlug, modules });
  } catch (error) {
    console.error("Module GET failed", error);
    const message = error instanceof Error ? error.message : "Unable to fetch modules";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantSlug = getTenantSlug(request);
    
    // Enforce admin permission on admin module
    const check = await enforcePermission(request, "admin", "admin", tenantSlug);
    if (!check.allowed) {
      return check.response;
    }
    
    const body = await request.json().catch(() => ({}));
    const validation = safeParse(CreateModuleSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request", details: validation.error.flatten() }, { status: 400 });
    }

    await ensureAdminTables();
    const data = validation.data;
    const id = await insertModule({ tenantSlug, key: data.key, name: data.name, enabled: data.enabled ?? false });
    return NextResponse.json({ module: { id, tenantSlug, key: data.key, name: data.name, enabled: data.enabled ?? false, regions: [], flags: {}, createdAt: new Date().toISOString() } }, { status: 201 });
  } catch (error) {
    console.error("Module create failed", error);
    const message = error instanceof Error ? error.message : "Unable to create module";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const tenantSlug = getTenantSlug(request);
    const id = new URL(request.url).searchParams.get("id");
    
    // Enforce admin permission on admin module
    const check = await enforcePermission(request, "admin", "admin", tenantSlug);
    if (!check.allowed) {
      return check.response;
    }
    
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    
    const body = await request.json().catch(() => ({}));
    const validation = safeParse(UpdateModuleSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request", details: validation.error.flatten() }, { status: 400 });
    }

    await ensureAdminTables();
    const data = validation.data;
    await updateModule(id, tenantSlug, { enabled: data.enabled, flags: data.flags });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Module patch failed", error);
    const message = error instanceof Error ? error.message : "Unable to update module";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const tenantSlug = getTenantSlug(request);
    const id = new URL(request.url).searchParams.get("id");
    
    // Enforce admin permission on admin module
    const check = await enforcePermission(request, "admin", "admin", tenantSlug);
    if (!check.allowed) {
      return check.response;
    }
    
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await ensureAdminTables();
    await deleteModule(id, tenantSlug);
    return NextResponse.json({ message: "deleted" }, { status: 200 });
  } catch (error) {
    console.error("Module delete failed", error);
    const message = error instanceof Error ? error.message : "Unable to delete module";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
