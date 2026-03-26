import { NextResponse } from 'next/server';
import type { User } from '../../../../../src/lib/admin/types';

// Minimal in-memory users store for initial API scaffolding. When `DATABASE_URL`
// is present, this route can be extended to use the real DB.
export const users = new Map<string, User>();

function sampleUser(): User {
  return {
    id: 'local-1',
    email: 'admin@example.com',
    name: 'Tenant Admin',
    status: 'active',
    contractType: 'full_time',
    createdAt: new Date().toISOString(),
  };
}

users.set('local-1', sampleUser());

export async function GET() {
  const list = Array.from(users.values());
  return NextResponse.json({ data: list });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // CSV import: { users: [{email, name}] }
    if (Array.isArray(body?.users)) {
      const created: User[] = [];
      for (const user of body.users) {
        if (!user.email) continue;
        const id = `local-${Math.random().toString(36).slice(2, 10)}`;
        const u: User = {
          id,
          email: user.email,
          name: user.name,
          status: 'invited',
          contractType: user.contractType ?? 'full_time',
          createdAt: new Date().toISOString(),
        };
        users.set(id, u);
        created.push(u);
      }
      return NextResponse.json({ data: created }, { status: 201 });
    }
    // Invite: { email, name? }
    if (!body?.email) return NextResponse.json({ error: 'missing email' }, { status: 400 });
    const id = `local-${Math.random().toString(36).slice(2, 10)}`;
    const u: User = {
      id,
      email: body.email,
      name: body.name,
      status: 'invited',
      contractType: body.contractType ?? 'full_time',
      createdAt: new Date().toISOString(),
    };
    users.set(id, u);
    return NextResponse.json({ data: u }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
}
