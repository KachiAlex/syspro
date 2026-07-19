import { NextResponse } from 'next/server';
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { getAllProjectsForTenant } from "@/lib/projects/db";

function buildMetrics(projects: any[]) {
  const total = projects.length;
  const completed = projects.filter(p => p.status === 'COMPLETED').length;
  const archived = projects.filter(p => p.status === 'ARCHIVED').length;
  const cancelled = projects.filter(p => p.status === 'CANCELLED').length;
  const active = total - completed - archived - cancelled;
  const totalBudget = projects.reduce((sum, p) => sum + Number(p.total_budget_amount ?? 0), 0);
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    totalProjects: total,
    completedProjects: completed,
    activeProjects: active,
    archivedProjects: archived,
    cancelledProjects: cancelled,
    totalBudget,
    completionRate,
    budgetUtilization: totalBudget > 0 ? 100 : 0,
    onTimeProjects: active,
    overdueProjects: 0,
  };
}

export async function GET(request: Request) {
  try {
    const context = validateTenantContext(request as any, "read");
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'performance';
    const projects = await getAllProjectsForTenant(context.tenantSlug, 1000);
    const metrics = buildMetrics(projects);

    const data: Record<string, any> = {
      performance: { ...metrics, averageProjectDuration: 0 },
      financial: { ...metrics, totalSpent: 0, remaining: metrics.totalBudget, averageBudgetPerProject: metrics.totalProjects > 0 ? Math.round(metrics.totalBudget / metrics.totalProjects) : 0 },
      timeline: { ...metrics, onTimePercentage: metrics.totalProjects > 0 ? Math.round((metrics.onTimeProjects / metrics.totalProjects) * 100) : 0, overduePercentage: 0 },
      resource: { totalTeamMembers: 0, averageTeamSize: 0, resourceUtilization: 0 },
    };

    return NextResponse.json({
      type: reportType,
      generatedAt: new Date().toISOString(),
      tenantSlug: context.tenantSlug,
      data: data[reportType] || metrics,
    });
  } catch (error) {
    console.error('Failed to generate advanced report:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate advanced report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
