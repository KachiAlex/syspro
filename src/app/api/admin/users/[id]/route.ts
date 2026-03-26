import { NextResponse } from 'next/server';
import { users } from '../route';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!users.has(params.id)) return NextResponse.json({ error: 'not found' }, { status: 404 });
  users.delete(params.id);
  return NextResponse.json({ ok: true });
}