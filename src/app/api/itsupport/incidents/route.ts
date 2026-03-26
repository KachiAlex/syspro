import { NextResponse } from 'next/server';
import type { Incident } from '../../../../lib/itsupport/types';

const incidents = new Map<string, Incident>();

export async function GET() {
  // List all incidents (stub)
  return NextResponse.json({ data: Array.from(incidents.values()) });
}

export async function POST(request: Request) {
  // Create a new incident (stub)
  const body = await request.json();
  const id = `local-${Math.random().toString(36).slice(2, 10)}`;
  const now = new Date().toISOString();
  const incident: Incident = {
    id,
    tenantId: body.tenantId,
    serviceType: body.serviceType,
    region: body.region,
    detectedAt: now,
    description: body.description,
    severity: body.severity,
    linkedTicketIds: body.linkedTicketIds || [],
  };
  incidents.set(id, incident);
  return NextResponse.json({ data: incident }, { status: 201 });
}
