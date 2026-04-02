import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'summary';
    const tenantSlug = searchParams.get('tenantSlug') || 'kreatix-default';

    // Mock report data - replace with real database queries
    const reports: Record<string, any> = {
      summary: {
        totalProjects: 12,
        activeProjects: 5,
        completedProjects: 4,
        plannedProjects: 3,
        totalBudget: 500000,
        totalSpent: 350000,
        budgetUtilization: 70,
        averageProjectDuration: 120,
      },
      budget: {
        categories: [
          { name: 'Development', allocated: 250000, spent: 180000 },
          { name: 'Design', allocated: 100000, spent: 75000 },
          { name: 'Testing', allocated: 80000, spent: 60000 },
          { name: 'Deployment', allocated: 70000, spent: 35000 },
        ],
        totalAllocated: 500000,
        totalSpent: 350000,
        remaining: 150000,
      },
      timeline: {
        onTimeProjects: 8,
        atRiskProjects: 3,
        overdueProjects: 1,
        averageCompletion: 65,
      },
      performance: {
        teamProductivity: 85,
        qualityScore: 92,
        customerSatisfaction: 88,
        deliveryOnTime: 80,
      },
    };

    const report = reports[reportType] || reports.summary;

    return NextResponse.json({
      type: reportType,
      generatedAt: new Date().toISOString(),
      data: report,
    });
  } catch (error) {
    console.error('Failed to generate report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
