import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import bcrypt from 'bcryptjs';

const sql = getSql();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { email, name, role, password } = body;

    let passwordHash: string | null = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const result = await sql`
      UPDATE tenant_admins
      SET email = COALESCE(${email}, email),
          name = COALESCE(${name}, name),
          role = COALESCE(${role}, role),
          password_hash = COALESCE(${passwordHash}, password_hash)
      WHERE id = ${id}
      RETURNING id, email, name, role, tenant_id, created_at
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Tenant admin not found' }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating tenant admin:', error);
    return NextResponse.json({ error: 'Failed to update tenant admin' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { id } = await params;
  try {
    const result = await sql`DELETE FROM tenant_admins WHERE id = ${id} RETURNING *`;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Tenant admin not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Tenant admin deleted' }, { status: 204 });
  } catch (error) {
    console.error('Error deleting tenant admin:', error);
    return NextResponse.json({ error: 'Failed to delete tenant admin' }, { status: 500 });
  }
}