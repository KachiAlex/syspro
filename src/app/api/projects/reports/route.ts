import { NextResponse } from 'next/server';
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { getAllProjectsForTenant } from "@/lib/projects/db";

function computeMetrics(projects: any[]) {
  const total = projects.length;
  const completed = projects.filter(p => p.status === 'COMPLETED').length;
  const archived = projects.filter(p => p.status === 'ARCHIVED').length;
  const cancelled = projects.filter(p => p.status === 'CANCELLED').length;
  const active = total - completed - archived - cancelled;
  const totalBudget = projects.reduce((sum, p) => sum + Number(p.total_budget_amount ?? 0), 0);
  return { total, completed, archived, cancelled, active, totalBudget };
}

export async function GET(request: Request) {
  try {
    const context = validateTenantContext(request as any, "read");
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'summary';
    const projects = await getAllProjectsForTenant(context.tenantSlug, 1000);
    const metrics = computeMetrics(projects);

    const data: Record<string, any> = {
      summary: metrics,
      budget: { ...metrics, budgetUtilization: metrics.totalBudget > 0 ? 100 : 0 },
      timeline: { ...metrics, onTimeProjects: metrics.active, overdueProjects: 0, onTimePercentage: metrics.total > 0 ? Math.round((metrics.active / metrics.total) * 100) : 0 },
      performance: { ...metrics, completionRate: metrics.total > 0 ? Math.round((metrics.completed / metrics.total) * 100) : 0, averageProjectDuration: 0 },
    };

    return NextResponse.json({
      type: reportType,
      generatedAt: new Date().toISOString(),
      tenantSlug: context.tenantSlug,
      data: data[reportType] || metrics,
    });
  } catch (error) {
    console.error('Failed to generate report:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
