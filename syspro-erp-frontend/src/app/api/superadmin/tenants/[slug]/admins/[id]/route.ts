import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

const sql = getSql();

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { email, name, role } = body;

    const result = await sql`
      UPDATE tenant_admins
      SET email = COALESCE(${email}, email),
          name = COALESCE(${name}, name),
          role = COALESCE(${role}, role)
      WHERE id = ${id}
      RETURNING *
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
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const { id } = params;
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