import { NextRequest, NextResponse } from 'next/server';
import {
  insertStaffTask,
  listStaffTasks,
  updateStaffTask,
  deleteStaffTask,
} from '@/lib/hr/db';

const VALID_FREQUENCIES = ['daily', 'weekly', 'one-time'];
const VALID_STATUSES = ['pending', 'in_progress', 'completed', 'overdue'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantSlug, employeeId, title, description, frequency, dueDate, status, assignedBy } = body;

    if (!tenantSlug || !employeeId || !title || !frequency || !dueDate || !assignedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantSlug, employeeId, title, frequency, dueDate, assignedBy' },
        { status: 400 }
      );
    }

    if (!VALID_FREQUENCIES.includes(frequency)) {
      return NextResponse.json(
        { error: `Invalid frequency. Must be one of: ${VALID_FREQUENCIES.join(', ')}` },
        { status: 400 }
      );
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const task = await insertStaffTask({
      tenantSlug,
      employeeId,
      title,
      description,
      frequency,
      dueDate,
      status,
      assignedBy,
    });

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Error creating staff task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('tenantSlug');
    const employeeId = searchParams.get('employeeId') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const dueDate = searchParams.get('dueDate') ?? undefined;
    const dueBefore = searchParams.get('dueBefore') ?? undefined;

    if (!tenantSlug) {
      return NextResponse.json({ error: 'tenantSlug is required' }, { status: 400 });
    }

    const tasks = await listStaffTasks(tenantSlug, { employeeId, status, dueDate, dueBefore });
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Error fetching staff tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, tenantSlug, ...updates } = body;

    if (!taskId || !tenantSlug) {
      return NextResponse.json({ error: 'Missing required fields: taskId, tenantSlug' }, { status: 400 });
    }

    if (updates.frequency && !VALID_FREQUENCIES.includes(updates.frequency)) {
      return NextResponse.json(
        { error: `Invalid frequency. Must be one of: ${VALID_FREQUENCIES.join(', ')}` },
        { status: 400 }
      );
    }

    if (updates.status && !VALID_STATUSES.includes(updates.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const task = await updateStaffTask(tenantSlug, taskId, updates);
    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Error updating staff task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('tenantSlug');
    const taskId = searchParams.get('taskId');

    if (!tenantSlug || !taskId) {
      return NextResponse.json({ error: 'tenantSlug and taskId are required' }, { status: 400 });
    }

    await deleteStaffTask(tenantSlug, taskId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting staff task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
