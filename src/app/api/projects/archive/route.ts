import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('tenantSlug') || 'kreatix-default';

    // Mock data - replace with real database queries
    const archivedProjects = [
      {
        id: 'arch-1',
        name: 'Website Redesign 2024',
        description: 'Complete website redesign project',
        objective: 'Modernize company website',
        status: 'Completed',
        completedDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        budgetApproved: 75000,
        budgetSpent: 72500,
        owner: 'Alice Johnson',
      },
      {
        id: 'arch-2',
        name: 'Legacy System Migration',
        description: 'Migrate legacy system to cloud',
        objective: 'Move to cloud infrastructure',
        status: 'Completed',
        completedDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        budgetApproved: 150000,
        budgetSpent: 145000,
        owner: 'Bob Wilson',
      },
    ];

    return NextResponse.json({ projects: archivedProjects });
  } catch (error) {
    console.error('Failed to fetch archived projects:', error);
    return NextResponse.json({ error: 'Failed to fetch archived projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectIds, tenantSlug } = body;

    // Mock archive operation - replace with real database update
    console.log(`Archiving projects: ${projectIds.join(', ')}`);

    return NextResponse.json({ 
      success: true, 
      message: `${projectIds.length} project(s) archived successfully`,
      archivedCount: projectIds.length 
    });
  } catch (error) {
    console.error('Failed to archive projects:', error);
    return NextResponse.json({ error: 'Failed to archive projects' }, { status: 500 });
  }
}
