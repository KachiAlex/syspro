import { NextResponse } from 'next/server';
// TODO: Replace with real DB integration
import type { Ticket } from '../../../../lib/itsupport/types';
import type { SLA, EngineerProfile } from '../../../../lib/itsupport/types';
import { getSLAForCategory, computeSLADueTimes } from '../../../../lib/itsupport/sla';
import { slas } from '../sla/route';
import { findBestEngineer } from '../../../../lib/itsupport/assignment';
import { engineers } from '../engineers/route';

const tickets = new Map<string, Ticket>();

export async function GET() {
  // List all tickets (stub)
  return NextResponse.json({ data: Array.from(tickets.values()) });
}

export async function POST(request: Request) {
  // Create a new ticket (stub)
  const body = await request.json();
  const id = `local-${Math.random().toString(36).slice(2, 10)}`;
  const now = new Date();
  // Find SLA for category
  let sla: SLA | undefined = undefined;
  for (const s of slas.values()) {
    if (s.category === body.slaCategory) sla = s;
  }
  let slaResponseDue = now;
  let slaResolutionDue = now;
  if (sla) {
    const due = computeSLADueTimes(now, sla);
    slaResponseDue = due.responseDue;
    slaResolutionDue = due.resolutionDue;
  }
  // Assignment engine: find best-fit engineer
  const engineerList: EngineerProfile[] = Array.from(engineers.values());
  const { primary, backup } = findBestEngineer({
    ...body,
    id,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    slaResponseDue: slaResponseDue.toISOString(),
    slaResolutionDue: slaResolutionDue.toISOString(),
    status: 'new',
  }, engineerList);
  const ticket: Ticket = {
    id,
    tenantId: body.tenantId,
    branchId: body.branchId,
    department: body.department,
    type: body.type,
    impact: body.impact,
    slaCategory: body.slaCategory,
    title: body.title,
    description: body.description,
    status: 'new',
    createdBy: body.createdBy,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    slaResponseDue: slaResponseDue.toISOString(),
    slaResolutionDue: slaResolutionDue.toISOString(),
    tags: body.tags || [],
    assignedTo: primary?.id,
    backupEngineerId: backup?.id,
  };
  tickets.set(id, ticket);
  return NextResponse.json({ data: ticket }, { status: 201 });
}
