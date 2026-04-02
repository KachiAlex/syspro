import { NextResponse } from 'next/server';
import { apiClient } from '@/lib/api-client';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('tenantSlug') || 'kreatix-default';

    // Mock data - replace with real database queries
    const tasks = [
      {
        id: 'task-1',
        projectId: params.id,
        title: 'Design system architecture',
        description: 'Create comprehensive design system',
        status: 'in-progress',
        assignee: 'John Doe',
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        priority: 'high',
      },
      {
        id: 'task-2',
        projectId: params.id,
        title: 'Implement API endpoints',
        description: 'Build REST API',
        status: 'todo',
        assignee: 'Jane Smith',
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        priority: 'medium',
      },
    ];

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { title, status, tenantSlug } = body;

    // Mock data - replace with real database insertion
    const newTask = {
      id: `task-${Date.now()}`,
      projectId: params.id,
      title,
      description: '',
      status: status || 'todo',
      assignee: '',
      dueDate: new Date().toISOString().split('T')[0],
      priority: 'medium',
    };

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error('Failed to create task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
