import { NextRequest, NextResponse } from "next/server";
import { ensureAdminTables, insertModule, getModules, updateModule, deleteModule } from "@/lib/admin/db";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { CreateModuleSchema, UpdateModuleSchema, safeParse } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "read");
    await ensureAdminTables();
    const modules = await getModules(tenantSlug);
    return NextResponse.json({ tenant: tenantSlug, modules });
  } catch (error) {
    console.error("Module GET failed", error);
    const message = error instanceof Error ? error.message : "Unable to fetch modules";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "write");
    
    const body = await request.json().catch(() => ({}));
    const validation = safeParse(CreateModuleSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request", details: validation.error.flatten() }, { status: 400 });
    }

    await ensureAdminTables();
    const id = await insertModule({ tenantSlug, key: validation.data.key, name: validation.data.name, enabled: validation.data.enabled });
    return NextResponse.json({ module: { id, tenantSlug, key: validation.data.key, name: validation.data.name, enabled: validation.data.enabled, regions: [], flags: {}, createdAt: new Date().toISOString() } }, { status: 201 });
  } catch (error) {
    console.error("Module create failed", error);
    const message = error instanceof Error ? error.message : "Unable to create module";
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
    const validation = safeParse(UpdateModuleSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request", details: validation.error.flatten() }, { status: 400 });
    }

    await ensureAdminTables();
    await updateModule(id, tenantSlug, { enabled: validation.data.enabled, flags: validation.data.flags });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Module patch failed", error);
    const message = error instanceof Error ? error.message : "Unable to update module";
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
    await deleteModule(id, tenantSlug);
    return NextResponse.json({ message: "deleted" }, { status: 200 });
  } catch (error) {
    console.error("Module delete failed", error);
    const message = error instanceof Error ? error.message : "Unable to delete module";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
    console.error("Module delete failed", error);
    return NextResponse.json({ error: "Unable to delete module" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\\/+/g, "/");
    const segments = path.split("/").filter(Boolean);
    const idFromPath = segments[segments.length - 1];

    const body = await request.json().catch(() => ({}));
    const id = (body?.id ?? idFromPath)?.toString();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const index = MODULES.findIndex((m) => m.id === id || m.key === id);
    if (index === -1) return NextResponse.json({ error: "not found" }, { status: 404 });

    const updated: Partial<typeof MODULES[number]> = {};
    if (body?.enabled !== undefined) updated.enabled = Boolean(body.enabled);
    if (Array.isArray(body?.regions)) updated.regions = body.regions;
    if (body?.flags && typeof body.flags === "object") updated.flags = { ...MODULES[index].flags, ...body.flags };

    MODULES[index] = { ...MODULES[index], ...updated };
    return NextResponse.json({ module: MODULES[index] });
  } catch (error) {
    console.error("Module patch failed", error);
    return NextResponse.json({ error: "Unable to update module" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\\/+/g, "/");
    const segments = path.split("/").filter(Boolean);
    const id = segments[segments.length - 1];
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const before = MODULES.length;
    MODULES = MODULES.filter((m) => m.id !== id && m.key !== id);
    if (MODULES.length === before) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ message: "deleted" }, { status: 200 });
  } catch (error) {
    console.error("Module delete failed", error);
    return NextResponse.json({ error: "Unable to delete module" }, { status: 500 });
  }
}
