import { NextResponse } from 'next/server';
import { sql as SQL } from '@/lib/sql-client';
import { requireModuleAccess } from '@/lib/api-auth';

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

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const _scope = await requireModuleAccess(req, 'admin', 'write');
  if (!_scope.ok) return _scope.response;
  const user = _scope.user;
  try {
    await ensureUsersTable();
    // Superadmin sessions have no tenantSlug — unrestricted. Tenant users can
    // only delete their own tenant's rows or legacy 'default' rows.
    const result = user.tenantSlug
      ? ((await SQL`delete from admin_users where id = ${params.id} and tenant_slug in (${user.tenantSlug}, 'default') returning id`) as any[])
      : ((await SQL`delete from admin_users where id = ${params.id} returning id`) as any[]);
    if (!result.length) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}