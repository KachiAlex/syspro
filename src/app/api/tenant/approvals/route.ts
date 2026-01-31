import { NextRequest, NextResponse } from "next/server";
import { ensureAdminTables, insertApprovalRoute, getApprovalRoutes, updateApprovalRoute, deleteApprovalRoute } from "@/lib/admin/db";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { CreateApprovalRouteSchema, UpdateApprovalRouteSchema, safeParse } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "read");
    await ensureAdminTables();
    const approvals = await getApprovalRoutes(tenantSlug);
    return NextResponse.json({ tenant: tenantSlug, approvals });
  } catch (error) {
    console.error("Approval GET failed", error);
    const message = error instanceof Error ? error.message : "Unable to fetch approvals";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "write");
    
    const body = await request.json().catch(() => ({}));
    const validation = safeParse(CreateApprovalRouteSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request", details: validation.error.flatten() }, { status: 400 });
    }

    await ensureAdminTables();
    const id = await insertApprovalRoute({ tenantSlug, name: validation.data.name, steps: validation.data.steps });
    return NextResponse.json({ approval: { id, tenantSlug, name: validation.data.name, steps: validation.data.steps, createdAt: new Date().toISOString() } }, { status: 201 });
  } catch (error) {
    console.error("Approval create failed", error);
    const message = error instanceof Error ? error.message : "Unable to create approval";
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
    const validation = safeParse(UpdateApprovalRouteSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request", details: validation.error.flatten() }, { status: 400 });
    }

    await ensureAdminTables();
    await updateApprovalRoute(id, tenantSlug, { steps: validation.data.steps });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Approval patch failed", error);
    const message = error instanceof Error ? error.message : "Unable to update approval";
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
    await deleteApprovalRoute(id, tenantSlug);
    return NextResponse.json({ message: "deleted" }, { status: 200 });
  } catch (error) {
    console.error("Approval delete failed", error);
    const message = error instanceof Error ? error.message : "Unable to delete approval";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
