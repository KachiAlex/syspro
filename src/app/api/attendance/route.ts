import { NextRequest, NextResponse } from 'next/server';
import { AttendanceRecord, AttendanceStatus, WorkMode } from '@/lib/attendance-types';
import AttendanceConfidenceCalculator from '@/lib/attendance-calculator';

// In-memory storage for attendance records (replace with database in production)
let attendanceRecords: AttendanceRecord[] = [];
let signalRecords: any[] = [];
let policyRecords: any[] = [];

// Default policy
const DEFAULT_POLICY = {
  id: 'default-policy',
  tenantId: 'all',
  name: 'Default Policy',
  presentThreshold: 70,
  lowConfidenceThreshold: 40,
  checkInWeight: 30,
  taskActivityWeight: 25,
  timeLoggedWeight: 25,
  meetingsWeight: 10,
  trainingWeight: 10,
  requiresCheckIn: true,
  allowsLateCheckIn: true,
  lateCheckInWindowMinutes: 30,
  requiresShiftConfirmation: false,
  requiresWeeklyAvailabilityConfirmation: false,
};

policyRecords.push(DEFAULT_POLICY);

/**
 * GET /api/attendance
 * - Get attendance records by filter (employee, date range, department, etc.)
 * - Returns daily, weekly, or monthly summaries
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  const tenantSlug = searchParams.get('tenantSlug');
  const employeeId = searchParams.get('employeeId');
  const workDate = searchParams.get('workDate');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const departmentId = searchParams.get('departmentId');

  if (!tenantSlug) {
    return NextResponse.json({ error: 'tenantSlug required' }, { status: 400 });
  }

  // Get today's attendance
  if (action === 'today') {
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = attendanceRecords.filter(
      r => r.tenantId === tenantSlug && r.workDate === today && (!employeeId || r.employeeId === employeeId)
    );
    return NextResponse.json({ records: todayRecords });
  }

  // Get weekly attendance
  if (action === 'weekly') {
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate required for weekly view' }, { status: 400 });
    }
    const weekRecords = attendanceRecords.filter(
      r => r.tenantId === tenantSlug && 
           r.workDate >= startDate && 
           r.workDate <= endDate &&
           (!employeeId || r.employeeId === employeeId) &&
           (!departmentId || r.departmentId === departmentId)
    );
    const summary = AttendanceConfidenceCalculator.calculateWeeklySummary(weekRecords);
    return NextResponse.json({ records: weekRecords, summary });
  }

  // Get monthly attendance (for payroll)
  if (action === 'monthly') {
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate required for monthly view' }, { status: 400 });
    }
    const monthRecords = attendanceRecords.filter(
      r => r.tenantId === tenantSlug && 
           r.workDate >= startDate && 
           r.workDate <= endDate &&
           (!employeeId || r.employeeId === employeeId) &&
           (!departmentId || r.departmentId === departmentId)
    );
    const compliance = AttendanceConfidenceCalculator.calculateMonthlyCompliance(monthRecords);
    return NextResponse.json({ records: monthRecords, compliance });
  }

  // Get attendance anomalies
  if (action === 'anomalies') {
    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId required for anomalies' }, { status: 400 });
    }
    const recentRecords = attendanceRecords
      .filter(r => r.tenantId === tenantSlug && r.employeeId === employeeId)
      .sort((a, b) => new Date(b.workDate).getTime() - new Date(a.workDate).getTime())
      .slice(0, 30); // Last 30 days
    
    const policy = policyRecords.find(p => p.tenantId === tenantSlug) || DEFAULT_POLICY;
    const anomalies = AttendanceConfidenceCalculator.detectAnomalies(employeeId, recentRecords, policy);
    return NextResponse.json({ anomalies });
  }

  // Default: Get records by date range or single date
  let filtered = attendanceRecords.filter(r => r.tenantId === tenantSlug);

  if (workDate) {
    filtered = filtered.filter(r => r.workDate === workDate);
  } else if (startDate && endDate) {
    filtered = filtered.filter(r => r.workDate >= startDate && r.workDate <= endDate);
  }

  if (employeeId) filtered = filtered.filter(r => r.employeeId === employeeId);
  if (departmentId) filtered = filtered.filter(r => r.departmentId === departmentId);

  return NextResponse.json({ records: filtered });
}

/**
 * POST /api/attendance
 * - Create new attendance record or update existing
 * - Handles check-in, check-out, mode selection
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, tenantSlug, employeeId, workDate, workMode, checkInTime, checkOutTime, overrideData } = body;

  if (!tenantSlug || !employeeId || !workDate) {
    return NextResponse.json({ error: 'tenantSlug, employeeId, workDate required' }, { status: 400 });
  }

  const policy = policyRecords.find(p => p.tenantId === tenantSlug) || DEFAULT_POLICY;
  const today = new Date().toISOString().split('T')[0];

  // Check in
  if (action === 'check-in') {
    let record = attendanceRecords.find(
      r => r.tenantId === tenantSlug && r.employeeId === employeeId && r.workDate === workDate
    );

    if (!record) {
      record = {
        id: crypto.randomUUID(),
        tenantId: tenantSlug,
        employeeId,
        workDate,
        workMode: workMode || 'ONSITE',
        confidenceScore: 0,
        attendanceStatus: 'PRESENT',
        checkInTime: new Date().toISOString(),
        shiftConfirmed: false,
        taskActivityCount: 0,
        timeLoggedHours: 0,
        meetingsAttended: 0,
        lmsActivityScore: 0,
        isOverride: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      attendanceRecords.push(record);
    } else {
      record.checkInTime = new Date().toISOString();
      record.updatedAt = new Date().toISOString();
    }

    // Recalculate ACS
    const input = {
      checkInProvided: !!record.checkInTime,
      taskActivityScore: AttendanceConfidenceCalculator.calculateTaskActivityScore(record.taskActivityCount),
      timeLoggedScore: AttendanceConfidenceCalculator.calculateTimeLoggedScore(record.timeLoggedHours),
      communicationScore: AttendanceConfidenceCalculator.calculateMeetingScore(record.meetingsAttended),
      trainingScore: AttendanceConfidenceCalculator.calculateTrainingScore(record.lmsActivityScore)
    };

    record.confidenceScore = AttendanceConfidenceCalculator.calculateACS(input, policy);
    record.attendanceStatus = AttendanceConfidenceCalculator.getAttendanceStatus(record.confidenceScore, policy, record);

    return NextResponse.json({ record, message: 'Check-in successful' });
  }

  // Check out
  if (action === 'check-out') {
    const record = attendanceRecords.find(
      r => r.tenantId === tenantSlug && r.employeeId === employeeId && r.workDate === workDate
    );

    if (!record) {
      return NextResponse.json({ error: 'No attendance record found for check-out' }, { status: 404 });
    }

    record.checkOutTime = new Date().toISOString();
    record.updatedAt = new Date().toISOString();

    return NextResponse.json({ record, message: 'Check-out successful' });
  }

  // Update work mode
  if (action === 'set-mode') {
    let record = attendanceRecords.find(
      r => r.tenantId === tenantSlug && r.employeeId === employeeId && r.workDate === workDate
    );

    if (!record) {
      record = {
        id: crypto.randomUUID(),
        tenantId: tenantSlug,
        employeeId,
        workDate,
        workMode,
        confidenceScore: 0,
        attendanceStatus: 'ABSENT',
        shiftConfirmed: false,
        taskActivityCount: 0,
        timeLoggedHours: 0,
        meetingsAttended: 0,
        lmsActivityScore: 0,
        isOverride: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      attendanceRecords.push(record);
    } else {
      record.workMode = workMode;
      record.updatedAt = new Date().toISOString();
    }

    return NextResponse.json({ record, message: 'Work mode updated' });
  }

  // Manual override
  if (action === 'override') {
    const { newStatus, newConfidenceScore, reason, notes, overriddenByUserId } = overrideData;
    
    let record = attendanceRecords.find(
      r => r.tenantId === tenantSlug && r.employeeId === employeeId && r.workDate === workDate
    );

    if (!record) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
    }

    const overrideLog = {
      id: crypto.randomUUID(),
      tenantId: tenantSlug,
      attendanceRecordId: record.id,
      overriddenByUserId,
      overrideTimestamp: new Date().toISOString(),
      previousStatus: record.attendanceStatus,
      newStatus,
      previousConfidenceScore: record.confidenceScore,
      newConfidenceScore,
      reason,
      notes,
      createdAt: new Date().toISOString(),
    };

    record.attendanceStatus = newStatus as AttendanceStatus;
    record.confidenceScore = newConfidenceScore;
    record.isOverride = true;
    record.overrideReason = reason;
    record.overrideByUserId = overriddenByUserId;
    record.updatedAt = new Date().toISOString();

    // Store override log
    signalRecords.push(overrideLog);

    return NextResponse.json({ record, overrideLog, message: 'Attendance overridden' });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

/**
 * PUT /api/attendance
 * - Update attendance signals (task activity, time logs, etc.)
 */
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { tenantSlug, employeeId, workDate, signalType, signalData } = body;

  if (!tenantSlug || !employeeId || !workDate || !signalType) {
    return NextResponse.json({ error: 'Required fields missing' }, { status: 400 });
  }

  let record = attendanceRecords.find(
    r => r.tenantId === tenantSlug && r.employeeId === employeeId && r.workDate === workDate
  );

  if (!record) {
    return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
  }

  const policy = policyRecords.find(p => p.tenantId === tenantSlug) || DEFAULT_POLICY;

  // Update signal data
  switch (signalType) {
    case 'TASK_UPDATE':
      record.taskActivityCount = (signalData?.count || 0);
      break;
    case 'TIME_LOG':
      record.timeLoggedHours = (signalData?.hours || 0);
      break;
    case 'MEETING_ATTENDED':
      record.meetingsAttended = (signalData?.count || 0);
      break;
    case 'LMS_ACTIVITY':
      record.lmsActivityScore = (signalData?.score || 0);
      break;
  }

  record.updatedAt = new Date().toISOString();

  // Recalculate ACS
  const input = {
    checkInProvided: !!record.checkInTime,
    taskActivityScore: AttendanceConfidenceCalculator.calculateTaskActivityScore(record.taskActivityCount),
    timeLoggedScore: AttendanceConfidenceCalculator.calculateTimeLoggedScore(record.timeLoggedHours),
    communicationScore: AttendanceConfidenceCalculator.calculateMeetingScore(record.meetingsAttended),
    trainingScore: AttendanceConfidenceCalculator.calculateTrainingScore(record.lmsActivityScore)
  };

  record.confidenceScore = AttendanceConfidenceCalculator.calculateACS(input, policy);
  record.attendanceStatus = AttendanceConfidenceCalculator.getAttendanceStatus(record.confidenceScore, policy, record);

  // Generate flags
  const flags = AttendanceConfidenceCalculator.generateFlags(record, policy);

  return NextResponse.json({ record, flags });
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tenantSlug = searchParams.get('tenantSlug');
  const recordId = searchParams.get('recordId');

  if (!tenantSlug || !recordId) {
    return NextResponse.json({ error: 'tenantSlug and recordId required' }, { status: 400 });
  }

  attendanceRecords = attendanceRecords.filter(r => r.id !== recordId || r.tenantId !== tenantSlug);
  return NextResponse.json({ message: 'Attendance record deleted' });
}
