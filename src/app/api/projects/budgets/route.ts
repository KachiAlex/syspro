export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";
import { getAllProjectsForTenant, updateProject } from "@/lib/projects/db";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const _gate1 = await requireModuleGate(request, "projects", "read");
  if (_gate1) return _gate1;
  const projects = await getAllProjectsForTenant(context.tenantSlug, 1000);
  const budgets = projects.map((p: any) => ({
    id: `budget-${p.id}`,
    projectId: p.id,
    projectName: p.name,
    totalBudget: Number(p.total_budget_amount ?? 0),
    spent: 0,
    remaining: Number(p.total_budget_amount ?? 0),
  }));
  return NextResponse.json({ budgets });
}

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const _gate2 = await requireModuleGate(request, "projects", "write");
  if (_gate2) return _gate2;
  const body = await request.json();
  const { projectId, totalBudget } = body;

  if (!projectId || totalBudget === undefined || totalBudget === null) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const updated = await updateProject(
    projectId,
    context.tenantSlug,
    { totalBudgetAmount: parseFloat(totalBudget) } as any
  );

  if (!updated) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const budget = {
    id: `budget-${updated.id}`,
    projectId: updated.id,
    projectName: updated.name,
    totalBudget: Number(updated.totalBudgetAmount ?? 0),
    spent: 0,
    remaining: Number(updated.totalBudgetAmount ?? 0),
  };

  return NextResponse.json(
    { budget, message: "Budget created successfully" },
    { status: 201 }
  );
}
