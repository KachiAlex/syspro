import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'performance';
    const tenantSlug = searchParams.get('tenantSlug') || 'kreatix-default';

    // Mock report data - replace with real database queries
    const reports: Record<string, any> = {
      performance: {
        totalProjects: 12,
        completedProjects: 4,
        activeProjects: 5,
        onHoldProjects: 3,
        completionRate: 33,
        averageProjectDuration: 120,
        projectsByStatus: [
          { status: 'Active', count: 5, percentage: 42 },
          { status: 'Completed', count: 4, percentage: 33 },
          { status: 'On Hold', count: 3, percentage: 25 },
        ],
      },
      financial: {
        totalBudget: 500000,
        totalSpent: 350000,
        remaining: 150000,
        budgetUtilization: 70,
        averageBudgetPerProject: 41667,
        averageSpendPerProject: 29167,
        topSpendingProjects: [
          { name: 'Mobile App Redesign', spent: 65000 },
          { name: 'API Integration', spent: 45000 },
          { name: 'Database Migration', spent: 38000 },
        ],
      },
      timeline: {
        totalProjects: 12,
        onTimeProjects: 8,
        overdueProjects: 1,
        atRiskProjects: 3,
        onTimePercentage: 67,
        overduePercentage: 8,
        atRiskPercentage: 25,
        averageDelay: 5,
      },
      resource: {
        totalTeamMembers: 45,
        averageTeamSize: 5,
        projectsPerTeamMember: 0.27,
        resourceUtilization: 85,
        topContributors: [
          { name: 'John Doe', projects: 4, hours: 320 },
          { name: 'Jane Smith', projects: 3, hours: 240 },
          { name: 'Alice Johnson', projects: 3, hours: 240 },
        ],
      },
    };

    const report = reports[reportType] || reports.performance;

    return NextResponse.json({
      type: reportType,
      generatedAt: new Date().toISOString(),
      tenantSlug,
      data: report,
    });
  } catch (error) {
    console.error('Failed to generate advanced report:', error);
    return NextResponse.json({ error: 'Failed to generate advanced report' }, { status: 500 });
  }
}
