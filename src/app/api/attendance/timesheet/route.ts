import { NextRequest, NextResponse } from 'next/server';
import { getTimesheetEntries, addTimesheetEntry, getTimesheetEntriesForDate } from '@/lib/persistent-storage';

/**
 * GET /api/attendance/timesheet
 * - Get timesheet entries for a specific date/employee
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tenantSlug = searchParams.get('tenantSlug');
  const employeeId = searchParams.get('employeeId');
  const workDate = searchParams.get('workDate');

  if (!tenantSlug || !employeeId || !workDate) {
    return NextResponse.json({ error: 'tenantSlug, employeeId, and workDate required' }, { status: 400 });
  }

  try {
    const entries = await getTimesheetEntriesForDate(tenantSlug, employeeId, workDate);
    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Error fetching timesheet entries:', error);
    return NextResponse.json({ error: 'Failed to fetch timesheet entries' }, { status: 500 });
  }
}

/**
 * POST /api/attendance/timesheet
 * - Add a new timesheet entry
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantSlug, employeeId, workDate, entryType, description, taskId, meetingId, location, notes } = body;

    if (!tenantSlug || !employeeId || !workDate || !entryType) {
      return NextResponse.json({ error: 'tenantSlug, employeeId, workDate, and entryType required' }, { status: 400 });
    }

    const entry = {
      id: crypto.randomUUID(),
      tenantSlug,
      employeeId,
      workDate,
      entryType,
      timestamp: new Date().toISOString(),
      description,
      taskId,
      meetingId,
      location,
      notes,
      createdAt: new Date().toISOString(),
    };

    await addTimesheetEntry(entry);

    return NextResponse.json({ entry, message: 'Timesheet entry added successfully' });
  } catch (error) {
    console.error('Error adding timesheet entry:', error);
    return NextResponse.json({ error: 'Failed to add timesheet entry' }, { status: 500 });
  }
}