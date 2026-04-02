import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('tenantSlug') || 'kreatix-default';

    // Mock data - replace with real database queries
    const members = [
      {
        id: 'member-1',
        projectId: params.id,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'lead',
        joinDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'member-2',
        projectId: params.id,
        name: 'Jane Smith',
        email: 'jane@example.com',
        role: 'member',
        joinDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    return NextResponse.json({ members });
  } catch (error) {
    console.error('Failed to fetch team members:', error);
    return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { email, role, tenantSlug } = body;

    // Mock data - replace with real database insertion
    const newMember = {
      id: `member-${Date.now()}`,
      projectId: params.id,
      name: email.split('@')[0],
      email,
      role: role || 'member',
      joinDate: new Date().toISOString(),
    };

    return NextResponse.json(newMember, { status: 201 });
  } catch (error) {
    console.error('Failed to add team member:', error);
    return NextResponse.json({ error: 'Failed to add team member' }, { status: 500 });
  }
}
