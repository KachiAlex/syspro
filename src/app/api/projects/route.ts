import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { getAllProjectsForTenant, createProject, toProjectResponse } from "@/lib/projects/db";

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

export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status");
    const search = (url.searchParams.get("search") ?? "").toLowerCase();
    const manager = (url.searchParams.get("manager") ?? "").toLowerCase();

    const projects = await getAllProjectsForTenant(context.tenantSlug);

    const mapped = projects.map(toProjectResponse);
    const filtered = mapped.filter((p) => {
      if (statusFilter && statusFilter !== "All" && p.status !== statusFilter) return false;
      if (search && !p.name.toLowerCase().includes(search) && !p.description.toLowerCase().includes(search)) return false;
      if (manager && !p.manager.toLowerCase().includes(manager)) return false;
      return true;
    });

    const totals = {
      count: projects.length,
      active: projects.filter((p) => ["IN_PROGRESS", "INITIATED"].includes(p.status)).length,
      approvedBudget: projects.reduce((sum, p) => sum + (Number(p.totalBudgetAmount) || 0), 0),
      spentBudget: 0,
    };

    return NextResponse.json({ projects: filtered, totals });
  } catch (error) {
    console.error("Projects GET failed:", error);
    const message = error instanceof Error ? error.message : "Unable to fetch projects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const body = await request.json();

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const code = body.code?.trim() || `PROJ-${randomUUID().slice(0, 8).toUpperCase()}`;
    const input = {
      code,
      name,
      description: body.description,
      status: parseStatus(body.status),
      priority: parsePriority(body.priority),
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
