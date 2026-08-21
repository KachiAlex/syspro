import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { db, sql as SQL } from '@/lib/sql-client';

async function ensureUsersTable() {
  await SQL`
    create table if not exists admin_users (
      id text primary key,
      tenant_slug text not null default 'default',
      email text not null,
      display_name text,
      status text not null default 'invited',
      contract_type text default 'full-time',
      primary_role_id text,
      metadata jsonb,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await SQL`create index if not exists idx_admin_users_tenant on admin_users (tenant_slug)`;
  await SQL`create index if not exists idx_admin_users_email on admin_users (email)`;
}

function mapUser(row: any) {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    email: row.email,
    displayName: row.display_name,
    status: row.status,
    contractType: row.contract_type,
    primaryRoleId: row.primary_role_id,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  try {
    await ensureUsersTable();
    const rows = (await SQL`select * from admin_users order by created_at desc`) as any[];
    return NextResponse.json({ data: rows.map(mapUser) });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureUsersTable();
    const body = await request.json();

    // CSV import: { users: [{email, name}] }
    if (Array.isArray(body?.users)) {
      const created: any[] = [];
      for (const user of body.users) {
        if (!user.email) continue;
        const id = randomUUID();
        const now = new Date().toISOString();
        const [row] = (await SQL`
          insert into admin_users (id, tenant_slug, email, display_name, status, contract_type, created_at, updated_at)
          values (${id}, 'default', ${user.email}, ${user.name ?? null}, 'invited', ${user.contractType ?? 'full-time'}, ${now}, ${now})
          returning *
        `) as any[];
        if (row) created.push(mapUser(row));
      }
      return NextResponse.json({ data: created }, { status: 201 });
    }

    // Invite: { email, name? }
    if (!body?.email) return NextResponse.json({ error: 'missing email' }, { status: 400 });
    const id = randomUUID();
    const now = new Date().toISOString();
    const [row] = (await SQL`
      insert into admin_users (id, tenant_slug, email, display_name, status, contract_type, created_at, updated_at)
      values (${id}, 'default', ${body.email}, ${body.name ?? null}, 'invited', ${body.contractType ?? 'full-time'}, ${now}, ${now})
      returning *
    `) as any[];
    return NextResponse.json({ data: mapUser(row) }, { status: 201 });
  } catch (error) {
    console.error('Failed to create user:', error);
    return NextResponse.json({ error: 'Failed to create user', details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}
