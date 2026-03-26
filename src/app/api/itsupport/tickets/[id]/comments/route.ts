import { NextResponse } from 'next/server';
import type { TicketComment } from '../../../../../../lib/itsupport/types';

const comments = new Map<string, TicketComment[]>();

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  // List comments for a ticket
  return NextResponse.json({ data: comments.get(params.id) || [] });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  // Add a comment to a ticket
  const body = await request.json();
  const now = new Date().toISOString();
  const comment: TicketComment = {
    id: `local-${Math.random().toString(36).slice(2, 10)}`,
    ticketId: params.id,
    authorId: body.authorId,
    body: body.body,
    createdAt: now,
  };
  if (!comments.has(params.id)) comments.set(params.id, []);
  comments.get(params.id)!.push(comment);
  return NextResponse.json({ data: comment }, { status: 201 });
}
