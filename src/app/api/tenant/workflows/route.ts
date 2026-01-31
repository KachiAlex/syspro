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
    console.error("Workflow delete failed", error);
    return NextResponse.json({ error: "Unable to delete workflow" }, { status: 500 });
  }
}
          daysAfter: s?.daysAfter ? Number(s.daysAfter) : undefined,
        }))
      : [];
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    const item = { id: randomUUID(), name, type, steps, createdAt: new Date().toISOString() };
    WORKFLOWS = [item, ...WORKFLOWS];
    return NextResponse.json({ workflow: item }, { status: 201 });
  } catch (error) {
    console.error("Workflow create failed", error);
    return NextResponse.json({ error: "Unable to create workflow" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+/g, "/");
    const segments = path.split("/").filter(Boolean);
    const idFromPath = segments[segments.length - 1];

    const body = await request.json().catch(() => ({}));
    const id = (body?.id ?? idFromPath)?.toString();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const index = WORKFLOWS.findIndex((w) => w.id === id);
    if (index === -1) return NextResponse.json({ error: "not found" }, { status: 404 });

    const updated: Partial<typeof WORKFLOWS[number]> = {};
    if (body?.name) updated.name = String(body.name);
    if (Array.isArray(body?.steps)) {
      updated.steps = body.steps.map((s: any, i: number) => ({
        step: Number(s?.step ?? i + 1),
        title: String(s?.title ?? ""),
        assignee: s?.assignee?.toString() || undefined,
        daysAfter: s?.daysAfter ? Number(s.daysAfter) : undefined,
      }));
    }

    WORKFLOWS[index] = { ...WORKFLOWS[index], ...updated };
    return NextResponse.json({ workflow: WORKFLOWS[index] });
  } catch (error) {
    console.error("Workflow patch failed", error);
    return NextResponse.json({ error: "Unable to update workflow" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+/g, "/");
    const segments = path.split("/").filter(Boolean);
    const id = segments[segments.length - 1];
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const before = WORKFLOWS.length;
    WORKFLOWS = WORKFLOWS.filter((w) => w.id !== id);
    if (WORKFLOWS.length === before) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ message: "deleted" }, { status: 200 });
  } catch (error) {
    console.error("Workflow delete failed", error);
    return NextResponse.json({ error: "Unable to delete workflow" }, { status: 500 });
  }
}
