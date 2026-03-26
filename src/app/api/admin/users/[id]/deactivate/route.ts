import { NextResponse } from 'next/server';
import { users } from '../../route';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = users.get(params.id);
  if (!user) return NextResponse.json({ error: 'not found' }, { status: 404 });
  user.status = 'inactive';
  users.set(params.id, user);
  return NextResponse.json({ data: user });
}