import { NextResponse } from 'next/server';
import type { EngineerProfile } from '../../../../lib/itsupport/types';

export const engineers = new Map<string, EngineerProfile>();

export async function GET() {
  // List all engineers (stub)
  return NextResponse.json({ data: Array.from(engineers.values()) });
}

export async function POST(request: Request) {
  // Create a new engineer (stub)
  const body = await request.json();
  const id = `local-${Math.random().toString(36).slice(2, 10)}`;
  const engineer: EngineerProfile = {
    id,
    tenantId: body.tenantId,
    name: body.name,
    skills: body.skills || [],
    branchId: body.branchId,
    onDuty: !!body.onDuty,
    workload: body.workload || 0,
    performanceScore: body.performanceScore || 0,
    location: body.location,
  };
  engineers.set(id, engineer);
  return NextResponse.json({ data: engineer }, { status: 201 });
}
