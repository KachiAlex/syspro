import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { getProject, updateProject, deleteProject, toProjectResponse } from "@/lib/projects/db";

function parseStatus(input?: string): string {
  const s = (input ?? "").toLowerCase().replace(/\s+/g, "_");
  const map: Record<string, string> = {
    planning: "PLANNING",
    initiated: "INITIATED",
    in_progress: "IN_PROGRESS",
    on_hold: "ON_HOLD",
    completed: "COMPLETED",
    archived: "ARCHIVED",
    cancelled: "CANCELLED",
  };
  return map[s] || s.toUpperCase() || "PLANNING";
}

function parsePriority(input?: string): string {
  const p = (input ?? "").toLowerCase();
  const map: Record<string, string> = {
    low: "LOW",
    medium: "MEDIUM",
    high: "HIGH",
    critical: "CRITICAL",
  };
  return map[p] || p.toUpperCase() || "MEDIUM";
}

function parseNumber(value: any): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(String(value).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = validateTenantContext(request, "read");
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
    const body = await request.json();

    const input: any = {};
    if (body.name !== undefined) input.name = body.name?.trim();
    if (body.description !== undefined) input.description = body.description;
    if (body.status !== undefined) input.status = parseStatus(body.status);
    if (body.priority !== undefined) input.priority = parsePriority(body.priority);
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
