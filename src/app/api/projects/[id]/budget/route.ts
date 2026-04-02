import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('tenantSlug') || 'kreatix-default';

    // Mock data - replace with real database queries
    const allocations = [
      {
        id: 'alloc-1',
        projectId: params.id,
        category: 'Development',
        allocated: 50000,
        spent: 35000,
      },
      {
        id: 'alloc-2',
        projectId: params.id,
        category: 'Design',
        allocated: 20000,
        spent: 15000,
      },
      {
        id: 'alloc-3',
        projectId: params.id,
        category: 'Testing',
        allocated: 15000,
        spent: 8000,
      },
    ];

    return NextResponse.json({ allocations });
  } catch (error) {
    console.error('Failed to fetch budget allocations:', error);
    return NextResponse.json({ error: 'Failed to fetch budget allocations' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { category, allocated, tenantSlug } = body;

    // Mock data - replace with real database insertion
    const newAllocation = {
      id: `alloc-${Date.now()}`,
      projectId: params.id,
      category,
      allocated: parseFloat(allocated),
      spent: 0,
    };

    return NextResponse.json(newAllocation, { status: 201 });
  } catch (error) {
    console.error('Failed to create budget allocation:', error);
    return NextResponse.json({ error: 'Failed to create budget allocation' }, { status: 500 });
  }
}
