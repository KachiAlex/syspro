import { NextResponse } from 'next/server';
import { tickets } from '../../route';
import { activityLogs } from '../activity/route';
import { transitionTicket } from '../../../../../../lib/itsupport/workflow';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  // Transition ticket status
  const ticket = tickets.get(params.id);
  if (!ticket) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const body = await request.json();
  const { toStatus, actorId } = body;
  try {
    const { ticket: updated, log } = transitionTicket(ticket, toStatus, actorId);
    tickets.set(params.id, updated);
    if (!activityLogs.has(params.id)) activityLogs.set(params.id, []);
    activityLogs.get(params.id)!.push(log);
    return NextResponse.json({ data: updated, log });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
