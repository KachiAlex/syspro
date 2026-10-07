export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";
import { getAllProjectsForTenant, createProject, toProjectResponse } from "@/lib/projects/db";

const VALID_STATUSES = new Set(["PLANNING", "INITIATED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "ARCHIVED", "CANCELLED"]);
const VALID_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

function parseStatus(input?: string): string {
  if (input === undefined || input === null || input === "") return "PLANNING";
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

function parsePriority(input?: string): string {
  if (input === undefined || input === null || input === "") return "MEDIUM";
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

export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");
    const _gate1 = await requireModuleGate(request, "projects", "read");
    if (_gate1) return _gate1;
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status");
    const search = (url.searchParams.get("search") ?? "").toLowerCase();
    const manager = (url.searchParams.get("manager") ?? "").toLowerCase();

    const projects = await getAllProjectsForTenant(context.tenantSlug) as any[];

    const filtered = projects.filter((p) => {
      if (statusFilter && statusFilter !== "All" && p.status !== statusFilter) return false;
      if (search && !p.name.toLowerCase().includes(search) && !(p.description ?? "").toLowerCase().includes(search)) return false;
      if (manager && !(p.project_manager_id ?? p.created_by ?? "").toLowerCase().includes(manager)) return false;
      return true;
    });

    const totals = {
      count: projects.length,
      active: projects.filter((p) => ["IN_PROGRESS", "INITIATED"].includes(p.status)).length,
      approvedBudget: projects.reduce((sum, p) => sum + (Number(p.total_budget_amount) || 0), 0),
      spentBudget: 0,
    };

    const mapped = filtered.map(toProjectResponse);

    return NextResponse.json({ projects: mapped, totals });
  } catch (error) {
    console.error("Projects GET failed:", error);
    const message = error instanceof Error ? error.message : "Unable to fetch projects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const _gate2 = await requireModuleGate(request, "projects", "write");
    if (_gate2) return _gate2;
    const body = await request.json();

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const code = body.code?.trim() || `PROJ-${randomUUID().slice(0, 8).toUpperCase()}`;
    let status: string;
    let priority: string;
    try {
      status = parseStatus(body.status);
      priority = parsePriority(body.priority);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid value" },
        { status: 400 }
      );
    }
    const input = {
      code,
      name,
      description: body.description,
      status,
      priority,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      plannedEndDate: body.dueDate || body.endDate || body.plannedEndDate ? new Date(body.dueDate || body.endDate || body.plannedEndDate) : undefined,
      totalBudgetAmount: parseNumber(body.budgetApproved ?? body.budget ?? body.totalBudgetAmount),
      projectManagerId: body.owner ?? body.manager ?? undefined,
      scopeDescription: body.objective,
      deliverables: body.deliverables,
      departmentId: body.departmentId,
      branchId: body.branchId,
      sponsorId: body.sponsorId,
      budgetId: body.budgetId,
    };

    const project = await createProject(context.tenantSlug, input as any, context.userId);
    if (!project) {
      return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
    }

    return NextResponse.json(
      { project: toProjectResponse(project), message: "Project created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Projects POST failed:", error);
    const message = error instanceof Error ? error.message : "Unable to create project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
