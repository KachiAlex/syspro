import { NextRequest, NextResponse } from 'next/server';
import { AttendancePolicy } from '@/lib/attendance-types';

// In-memory storage
let policyRecords: AttendancePolicy[] = [
  {
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

/**
 * GET /api/attendance/policies
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tenantSlug = searchParams.get('tenantSlug');
  const policyId = searchParams.get('policyId');

  if (!tenantSlug) {
    return NextResponse.json({ error: 'tenantSlug required' }, { status: 400 });
  }

  if (policyId) {
    const policy = policyRecords.find(p => p.id === policyId && p.tenantId === tenantSlug);
    return NextResponse.json({ policy });
  }

  const policies = policyRecords.filter(p => p.tenantId === tenantSlug || p.tenantId === 'all');
  return NextResponse.json({ policies });
}

/**
 * POST /api/attendance/policies
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    tenantSlug,
    name,
    presentThreshold,
    lowConfidenceThreshold,
    checkInWeight,
    taskActivityWeight,
    timeLoggedWeight,
    meetingsWeight,
    trainingWeight,
    requiresCheckIn,
    allowsLateCheckIn,
    lateCheckInWindowMinutes,
    requiresShiftConfirmation,
    requiresWeeklyAvailabilityConfirmation,
  } = body;

  if (!tenantSlug || !name) {
    return NextResponse.json({ error: 'tenantSlug and name required' }, { status: 400 });
  }

  const policy: AttendancePolicy = {
    id: crypto.randomUUID(),
    tenantId: tenantSlug,
    name,
    presentThreshold: presentThreshold || 70,
    lowConfidenceThreshold: lowConfidenceThreshold || 40,
    checkInWeight: checkInWeight || 30,
    taskActivityWeight: taskActivityWeight || 25,
    timeLoggedWeight: timeLoggedWeight || 25,
    meetingsWeight: meetingsWeight || 10,
    trainingWeight: trainingWeight || 10,
    requiresCheckIn: requiresCheckIn !== false,
    allowsLateCheckIn: allowsLateCheckIn !== false,
    lateCheckInWindowMinutes: lateCheckInWindowMinutes || 30,
    requiresShiftConfirmation: requiresShiftConfirmation || false,
    requiresWeeklyAvailabilityConfirmation: requiresWeeklyAvailabilityConfirmation || false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  policyRecords.push(policy);
  return NextResponse.json({ policy, message: 'Policy created' });
}

/**
 * PUT /api/attendance/policies
 */
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { tenantSlug, policyId, ...updates } = body;

  if (!tenantSlug || !policyId) {
    return NextResponse.json({ error: 'tenantSlug and policyId required' }, { status: 400 });
  }

  const policy = policyRecords.find(p => p.id === policyId && p.tenantId === tenantSlug);
  if (!policy) {
    return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
  }

  Object.assign(policy, updates);
  policy.updatedAt = new Date().toISOString();

  return NextResponse.json({ policy, message: 'Policy updated' });
}

/**
 * DELETE /api/attendance/policies
 */
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tenantSlug = searchParams.get('tenantSlug');
  const policyId = searchParams.get('policyId');

  if (!tenantSlug || !policyId) {
    return NextResponse.json({ error: 'tenantSlug and policyId required' }, { status: 400 });
  }

  policyRecords = policyRecords.filter(p => p.id !== policyId || p.tenantId !== tenantSlug);
  return NextResponse.json({ message: 'Policy deleted' });
}
