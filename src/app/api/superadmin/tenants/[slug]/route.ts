import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

const sql = getSql();

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const tenant = await sql`SELECT * FROM tenants WHERE slug = ${slug}`;

    if (tenant.length === 0) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Also fetch licenses and admins
    const licenses = await sql`SELECT * FROM licenses WHERE tenant_id = ${tenant[0].id}`;
    const admins = await sql`SELECT * FROM tenant_admins WHERE tenant_id = ${tenant[0].id}`;

    return NextResponse.json({
      ...tenant[0],
      licenses,
      admins
    });
  } catch (error) {
    console.error('Error fetching tenant:', error);
    return NextResponse.json({ error: 'Failed to fetch tenant' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const body = await request.json();
    const { name, seats } = body;

    const result = await sql`
      UPDATE tenants
      SET name = COALESCE(${name}, name),
          seats = COALESCE(${seats}, seats),
          updated_at = NOW()
      WHERE slug = ${slug}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating tenant:', error);
    return NextResponse.json({ error: 'Failed to update tenant' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const result = await sql`DELETE FROM tenants WHERE slug = ${slug} RETURNING *`;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Tenant deleted' }, { status: 204 });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    return NextResponse.json({ error: 'Failed to delete tenant' }, { status: 500 });
  }
}