import { NextRequest, NextResponse } from "next/server";
import { ensureAdminTables, insertWorkflow, getWorkflows, updateWorkflow, deleteWorkflow } from "@/lib/admin/db";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { CreateWorkflowSchema, UpdateWorkflowSchema, safeParse } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "read");
    await ensureAdminTables();
    const workflows = await getWorkflows(tenantSlug);
    return NextResponse.json({ tenant: tenantSlug, workflows });
  } catch (error) {
    console.error("Workflow GET failed", error);
    const message = error instanceof Error ? error.message : "Unable to fetch workflows";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "write");
    
    const body = await request.json().catch(() => ({}));
    const validation = safeParse(CreateWorkflowSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request", details: validation.error.flatten() }, { status: 400 });
    }

    await ensureAdminTables();
    const id = await insertWorkflow({ tenantSlug, name: validation.data.name, type: validation.data.type, steps: validation.data.steps });
    return NextResponse.json({ workflow: { id, tenantSlug, name: validation.data.name, type: validation.data.type, steps: validation.data.steps, createdAt: new Date().toISOString() } }, { status: 201 });
  } catch (error) {
    console.error("Workflow create failed", error);
    const message = error instanceof Error ? error.message : "Unable to create workflow";
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
    const validation = safeParse(UpdateWorkflowSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request", details: validation.error.flatten() }, { status: 400 });
    }

    await ensureAdminTables();
    await updateWorkflow(id, tenantSlug, { steps: validation.data.steps });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Workflow patch failed", error);
    const message = error instanceof Error ? error.message : "Unable to update workflow";
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
    await deleteWorkflow(id, tenantSlug);
    return NextResponse.json({ message: "deleted" }, { status: 200 });
  } catch (error) {
    console.error("Workflow delete failed", error);
    const message = error instanceof Error ? error.message : "Unable to delete workflow";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
