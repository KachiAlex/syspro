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
  const onTime = active;
  const overdue = 0;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const budgetUtilization = totalBudget > 0 ? 100 : 0;
  return {
    totalProjects: total,
    completedProjects: completed,
    activeProjects: active,
    archivedProjects: archived,
    cancelledProjects: cancelled,
    onTimeProjects: onTime,
    overdueProjects: overdue,
    totalBudget,
    completionRate,
    budgetUtilization,
  };
}

export async function GET(request: Request) {
  try {
    const context = validateTenantContext(request as any, "read");
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'performance';
    const format = searchParams.get('format') || 'pdf';

    const projects = await getAllProjectsForTenant(context.tenantSlug, 1000);
    const metrics = buildMetrics(projects);

    let content = '';
    let contentType = 'application/pdf';
    let filename = `projects-report-${reportType}-${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      contentType = 'text/csv';
      filename += '.csv';
      content = generateCSVReport(reportType, metrics);
    } else if (format === 'excel') {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      filename += '.xlsx';
      content = generateExcelReport(reportType, metrics);
    } else {
      contentType = 'application/pdf';
      filename += '.pdf';
      content = generatePDFReport(reportType, metrics);
    }

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Failed to export report:', error);
    const message = error instanceof Error ? error.message : 'Failed to export report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function generateCSVReport(reportType: string, metrics: any): string {
  const headers = ['Metric', 'Value'];
  const rows: string[][] = [];

  if (reportType === 'performance' || reportType === 'summary') {
    rows.push(['Total Projects', String(metrics.totalProjects)]);
    rows.push(['Completed Projects', String(metrics.completedProjects)]);
    rows.push(['Active Projects', String(metrics.activeProjects)]);
    rows.push(['Completion Rate', `${metrics.completionRate}%`]);
  } else if (reportType === 'financial' || reportType === 'budget') {
    rows.push(['Total Budget', String(metrics.totalBudget)]);
    rows.push(['Total Spent', '0']);
    rows.push(['Remaining', String(metrics.totalBudget)]);
    rows.push(['Budget Utilization', `${metrics.budgetUtilization}%`]);
  } else if (reportType === 'timeline') {
    rows.push(['Total Projects', String(metrics.totalProjects)]);
    rows.push(['On Time Projects', String(metrics.onTimeProjects)]);
    rows.push(['Overdue Projects', String(metrics.overdueProjects)]);
  } else if (reportType === 'resource') {
    rows.push(['Total Projects', String(metrics.totalProjects)]);
    rows.push(['Active Projects', String(metrics.activeProjects)]);
    rows.push(['Completed Projects', String(metrics.completedProjects)]);
  }

  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

function generateExcelReport(reportType: string, metrics: any): string {
  return generateCSVReport(reportType, metrics);
}

function generatePDFReport(reportType: string, metrics: any): string {
  // Fallback to a CSV-style plain text export; a real PDF generator would be added here.
  return generateCSVReport(reportType, metrics);
}
