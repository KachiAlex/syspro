import { NextResponse } from 'next/server';
import type { SLA } from '../../../../lib/itsupport/types';

export const slas = new Map<string, SLA>();

export async function GET() {
  // List all SLAs (stub)
  return NextResponse.json({ data: Array.from(slas.values()) });
}

export async function POST(request: Request) {
  // Create a new SLA (stub)
  const body = await request.json();
  const id = `local-${Math.random().toString(36).slice(2, 10)}`;
  const now = new Date().toISOString();
  const sla: SLA = {
    id,
    tenantId: body.tenantId,
    category: body.category,
    responseMinutes: body.responseMinutes,
    resolutionMinutes: body.resolutionMinutes,
    createdAt: now,
  };
  slas.set(id, sla);
  return NextResponse.json({ data: sla }, { status: 201 });
}
