import { NextResponse } from 'next/server';
import type { TicketActivityLog } from '../../../../../../lib/itsupport/types';

export const activityLogs = new Map<string, TicketActivityLog[]>();

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  // List activity logs for a ticket
  return NextResponse.json({ data: activityLogs.get(params.id) || [] });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  // Add an activity log to a ticket
  const body = await request.json();
  const now = new Date().toISOString();
  const log: TicketActivityLog = {
    id: `local-${Math.random().toString(36).slice(2, 10)}`,
    ticketId: params.id,
    action: body.action,
    actorId: body.actorId,
    fromStatus: body.fromStatus,
    toStatus: body.toStatus,
    timestamp: now,
    details: body.details,
  };
  if (!activityLogs.has(params.id)) activityLogs.set(params.id, []);
  activityLogs.get(params.id)!.push(log);
  return NextResponse.json({ data: log }, { status: 201 });
}
