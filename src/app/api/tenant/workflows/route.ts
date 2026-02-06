import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { CreateWorkflowSchema, UpdateWorkflowSchema, safeParse } from "@/lib/validation";

type WorkflowType = "onboarding" | "transfer" | "promotion" | "exit";
type WorkflowStep = { step: number; title: string; assignee?: string; daysAfter?: number };
type WorkflowRecord = {
  id: string;
  tenantSlug: string;
  name: string;
  type: WorkflowType;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
};

const databaseEnabled = Boolean(process.env.DATABASE_URL);
type AdminDbModule = typeof import("@/lib/admin/db");
let adminDbModulePromise: Promise<AdminDbModule> | null = null;

async function getAdminDbModule(): Promise<AdminDbModule> {
  if (!adminDbModulePromise) {
    adminDbModulePromise = import("@/lib/admin/db");
  }
  return adminDbModulePromise;
}

const fallbackWorkflows = new Map<string, WorkflowRecord[]>();

function seedFallbackWorkflows(tenantSlug: string): WorkflowRecord[] {
  const now = new Date().toISOString();
  return [
    {
      id: "wf-onboarding",
      tenantSlug,
      name: "New Hire Onboarding",
      type: "onboarding",
      steps: [
        { step: 1, title: "Account provisioning", assignee: "IT", daysAfter: 0 },
        { step: 2, title: "Equipment pickup", assignee: "Workplace", daysAfter: 1 },
        { step: 3, title: "Manager welcome call", assignee: "People Ops", daysAfter: 2 },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "wf-exit",
      tenantSlug,
      name: "Employee Exit",
      type: "exit",
      steps: [
        { step: 1, title: "Disable credentials", assignee: "Security", daysAfter: 0 },
        { step: 2, title: "Asset return checklist", assignee: "Facilities", daysAfter: 1 },
        { step: 3, title: "Knowledge capture", assignee: "Team Lead", daysAfter: 2 },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function getTenantWorkflows(tenantSlug: string): WorkflowRecord[] {
  if (!fallbackWorkflows.has(tenantSlug)) {
    fallbackWorkflows.set(tenantSlug, seedFallbackWorkflows(tenantSlug));
  }
  return fallbackWorkflows.get(tenantSlug)!;
}

function cloneWorkflow(workflow: WorkflowRecord): WorkflowRecord {
  return {
    ...workflow,
    steps: workflow.steps.map((step) => ({ ...step })),
  };
}

function sanitizeSteps(input: WorkflowStep[]): WorkflowStep[] {
  return input.map((step, index) => ({
    step: step.step ?? index + 1,
    title: step.title,
    assignee: step.assignee,
    daysAfter: step.daysAfter ?? 0,
  }));
}

function listFallbackWorkflows(tenantSlug: string): WorkflowRecord[] {
  return getTenantWorkflows(tenantSlug).map(cloneWorkflow);
}

function createFallbackWorkflow(tenantSlug: string, data: { name: string; type: WorkflowType; steps: WorkflowStep[] }) {
  const workflow: WorkflowRecord = {
    id: randomUUID(),
    tenantSlug,
    name: data.name,
    type: data.type,
    steps: sanitizeSteps(data.steps),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const store = getTenantWorkflows(tenantSlug);
  store.unshift(workflow);
  return cloneWorkflow(workflow);
}

function updateFallbackWorkflow(tenantSlug: string, id: string, updates: { steps?: WorkflowStep[] }) {
  const store = getTenantWorkflows(tenantSlug);
  const index = store.findIndex((wf) => wf.id === id);
  if (index === -1) {
    throw new Error("Workflow not found");
  }
  if (updates.steps) {
    store[index] = {
      ...store[index],
      steps: sanitizeSteps(updates.steps),
      updatedAt: new Date().toISOString(),
    };
  }
  return cloneWorkflow(store[index]);
}

function deleteFallbackWorkflow(tenantSlug: string, id: string) {
  const store = getTenantWorkflows(tenantSlug);
  const index = store.findIndex((wf) => wf.id === id);
  if (index === -1) {
    throw new Error("Workflow not found");
  }
  store.splice(index, 1);
}

export async function GET(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "read");
    let workflows;
    if (databaseEnabled) {
      const { ensureAdminTables, getWorkflows } = await getAdminDbModule();
      await ensureAdminTables();
      workflows = await getWorkflows(tenantSlug);
    } else {
      workflows = listFallbackWorkflows(tenantSlug);
    }
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

    if (databaseEnabled) {
      const { ensureAdminTables, insertWorkflow } = await getAdminDbModule();
      await ensureAdminTables();
      const id = await insertWorkflow({ tenantSlug, name: validation.data.name, type: validation.data.type, steps: validation.data.steps });
      return NextResponse.json({ workflow: { id, tenantSlug, name: validation.data.name, type: validation.data.type, steps: validation.data.steps, createdAt: new Date().toISOString() } }, { status: 201 });
    }

    const workflow = createFallbackWorkflow(tenantSlug, validation.data);
    return NextResponse.json({ workflow }, { status: 201 });
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

    if (databaseEnabled) {
      const { ensureAdminTables, updateWorkflow } = await getAdminDbModule();
      await ensureAdminTables();
      await updateWorkflow(id, tenantSlug, { steps: validation.data.steps });
    } else {
      updateFallbackWorkflow(tenantSlug, id, { steps: validation.data.steps });
    }
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
    if (databaseEnabled) {
      const { ensureAdminTables, deleteWorkflow } = await getAdminDbModule();
      await ensureAdminTables();
      await deleteWorkflow(id, tenantSlug);
    } else {
      deleteFallbackWorkflow(tenantSlug, id);
    }
    return NextResponse.json({ message: "deleted" }, { status: 200 });
  } catch (error) {
    console.error("Workflow delete failed", error);
    const message = error instanceof Error ? error.message : "Unable to delete workflow";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
