export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { getProject, updateProject, deleteProject, toProjectResponse } from "@/lib/projects/db";

const VALID_STATUSES = new Set(["PLANNING", "INITIATED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "ARCHIVED", "CANCELLED"]);
const VALID_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

// Throws on unrecognized input so arbitrary status strings can't be stored.
function parseStatus(input: string): string {
  const s = input.toLowerCase().replace(/[\s-]+/g, "_");
  const map: Record<string, string> = {
    planning: "PLANNING",
    initiated: "INITIATED",
    in_progress: "IN_PROGRESS",
    inprogress: "IN_PROGRESS",
    on_hold: "ON_HOLD",
    onhold: "ON_HOLD",
    completed: "COMPLETED",
    complete: "COMPLETED",
    archived: "ARCHIVED",
    cancelled: "CANCELLED",
    canceled: "CANCELLED",
  };
  const normalized = map[s] ?? s.toUpperCase();
  if (!VALID_STATUSES.has(normalized)) {
    throw new Error(`Invalid status "${input}"`);
  }
  return normalized;
}

function parsePriority(input: string): string {
  const normalized = input.toUpperCase();
  if (!VALID_PRIORITIES.has(normalized)) {
    throw new Error(`Invalid priority "${input}"`);
  }
  return normalized;
}

function parseNumber(value: any): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(String(value).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = validateTenantContext(request, "read");
    if (!UUID_RE.test(params.id)) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const project = await getProject(params.id, context.tenantSlug);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ project: toProjectResponse(project) });
  } catch (error) {
    console.error("Project GET failed:", error);
    const message = error instanceof Error ? error.message : "Unable to fetch project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = validateTenantContext(request, "write");
    if (!UUID_RE.test(params.id)) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const body = await request.json();

    const input: any = {};
    if (body.name !== undefined) input.name = body.name?.trim();
    if (body.description !== undefined) input.description = body.description;
    try {
      if (body.status !== undefined) input.status = parseStatus(body.status);
      if (body.priority !== undefined) input.priority = parsePriority(body.priority);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid value" },
        { status: 400 }
      );
    }
    if (body.startDate !== undefined) input.startDate = new Date(body.startDate);
    if (body.dueDate !== undefined || body.endDate !== undefined || body.plannedEndDate !== undefined) {
      const raw = body.dueDate || body.endDate || body.plannedEndDate;
      input.plannedEndDate = raw ? new Date(raw) : undefined;
    }
    const budget = body.budgetApproved ?? body.budget ?? body.totalBudgetAmount;
    if (budget !== undefined) input.totalBudgetAmount = parseNumber(budget);
    const manager = body.owner ?? body.manager ?? body.projectManagerId;
    if (manager !== undefined) input.projectManagerId = manager;

    const project = await updateProject(params.id, context.tenantSlug, input);
    if (!project) {
      return NextResponse.json({ error: "Project not found or not updated" }, { status: 404 });
    }
    return NextResponse.json({ project: toProjectResponse(project), message: "Project updated successfully" });
  } catch (error) {
    console.error("Project PATCH failed:", error);
    const message = error instanceof Error ? error.message : "Unable to update project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = validateTenantContext(request, "delete");
    if (!UUID_RE.test(params.id)) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const deleted = await deleteProject(params.id, context.tenantSlug);
    if (!deleted) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error("Project DELETE failed:", error);
    const message = error instanceof Error ? error.message : "Unable to delete project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
