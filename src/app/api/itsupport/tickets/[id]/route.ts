import { NextResponse } from 'next/server';

import type { Ticket } from '../../../../../lib/itsupport/types';
import { tickets } from '../route';
import { transitionTicket } from '../../../../../lib/itsupport/workflow';
import { activityLogs } from './activity/route';
import { autoEscalate, detectSlaBreach } from '../../../../../lib/itsupport/automation';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ticket = tickets.get(params.id);
  if (!ticket) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ data: ticket });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ticket = tickets.get(params.id);
  if (!ticket) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const body = await request.json();
  // If status is changing, use workflow engine
  if (body.status && body.status !== ticket.status) {
    try {
      let { ticket: updated, log } = transitionTicket(ticket, body.status, body.actorId || 'system');
      // Automation: SLA breach detection and auto-escalate
      updated = await detectSlaBreach(updated);
      updated = await autoEscalate(updated);
      tickets.set(params.id, updated);
      if (!activityLogs.has(params.id)) activityLogs.set(params.id, []);
      activityLogs.get(params.id)!.push(log);
      return NextResponse.json({ data: updated, log });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }
  // Otherwise, just update fields
  Object.assign(ticket, body, { updatedAt: new Date().toISOString() });
  // Automation: SLA breach detection and auto-escalate
  let updated = await detectSlaBreach(ticket);
  updated = await autoEscalate(updated);
  tickets.set(params.id, updated);
  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!tickets.has(params.id)) return NextResponse.json({ error: 'not found' }, { status: 404 });
  tickets.delete(params.id);
  activityLogs.delete(params.id);
  return NextResponse.json({ ok: true });
}
