import { NextResponse } from 'next/server';
import { sql as SQL } from '@/lib/sql-client';

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

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    await ensureUsersTable();
    const [row] = (await SQL`
      update admin_users set status = 'suspended', updated_at = now()
      where id = ${params.id} returning *
    `) as any[];
    if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ data: mapUser(row) });
  } catch (error) {
    console.error('Failed to deactivate user:', error);
    return NextResponse.json({ error: 'Failed to deactivate user' }, { status: 500 });
  }
}