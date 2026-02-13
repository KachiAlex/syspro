import { NextResponse } from 'next/server';
import type { FieldJob } from '../../../../lib/itsupport/types';

export const fieldJobs = new Map<string, FieldJob>();

export async function GET() {
  // List all field jobs (stub)
  return NextResponse.json({ data: Array.from(fieldJobs.values()) });
}

export async function POST(request: Request) {
  // Create a new field job (stub)
  const body = await request.json();
  const id = `local-${Math.random().toString(36).slice(2, 10)}`;
  const now = new Date().toISOString();
  const job: FieldJob = {
    id,
    ticketId: body.ticketId,
    engineerId: body.engineerId,
    assignedAt: now,
    startedAt: body.startedAt,
    arrivedAt: body.arrivedAt,
    completedAt: body.completedAt,
    gpsStart: body.gpsStart,
    gpsArrive: body.gpsArrive,
    workLog: body.workLog,
    images: body.images || [],
    customerSignoff: !!body.customerSignoff,
  };
  fieldJobs.set(id, job);
  return NextResponse.json({ data: job }, { status: 201 });
}
