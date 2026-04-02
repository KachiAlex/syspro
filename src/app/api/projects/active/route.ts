import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('tenantSlug') || 'kreatix-default';

    // Mock data - replace with real database queries
    const activeProjects = [
      {
        id: 'proj-1',
        name: 'Mobile App Redesign',
        description: 'Complete redesign of mobile application',
        objective: 'Improve user experience and performance',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        priority: 'High',
        budgetApproved: 100000,
        budgetSpent: 65000,
        status: 'Active',
        owner: 'John Doe',
      },
      {
        id: 'proj-2',
        name: 'API Integration',
        description: 'Integrate third-party APIs',
        objective: 'Enable external data synchronization',
        startDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        priority: 'Medium',
        budgetApproved: 50000,
        budgetSpent: 25000,
        status: 'Active',
        owner: 'Jane Smith',
      },
    ];

    return NextResponse.json({ projects: activeProjects });
  } catch (error) {
    console.error('Failed to fetch active projects:', error);
    return NextResponse.json({ error: 'Failed to fetch active projects' }, { status: 500 });
  }
}
