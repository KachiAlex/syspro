import { NextResponse } from 'next/server';
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { getAllProjectsForTenant } from "@/lib/projects/db";

export async function GET(request: Request) {
  try {
    const context = validateTenantContext(request as any, "read");
    const projects = await getAllProjectsForTenant(context.tenantSlug, 1000);

    const total = projects.length;
    const completed = projects.filter((p) => p.status === "COMPLETED").length;
    const archived = projects.filter((p) => p.status === "ARCHIVED").length;
    const cancelled = projects.filter((p) => p.status === "CANCELLED").length;
    const active = total - completed - archived - cancelled;
    const totalBudgetRaw = projects.reduce((sum, p) => sum + Number((p as any).totalBudgetAmount ?? 0), 0);
    const completionRate = total > 0 ? Math.round(((completed + archived) / total) * 100) : 0;

    const durations = projects
      .filter((p) => p.startDate && (p.actualEndDate || p.plannedEndDate))
      .map((p) => {
        const start = new Date(p.startDate as any).getTime();
        const end = new Date((p.actualEndDate || p.plannedEndDate) as any).getTime();
        if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
        return (end - start) / (1000 * 60 * 60 * 24 * 30); // months
      })
      .filter((d): d is number => d !== null);
    const avgDuration = durations.length > 0
      ? Math.round((durations.reduce((s, d) => s + d, 0) / durations.length) * 10) / 10
      : 0;

    return NextResponse.json({
      total,
      active,
      completed,
      archived,
      totalBudget: Math.round(totalBudgetRaw / 1000), // in $K, matches UI formatting
      completionRate,
      avgDuration,
    });
  } catch (error) {
    console.error('Failed to compute project stats:', error);
    const message = error instanceof Error ? error.message : 'Failed to compute project stats';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
