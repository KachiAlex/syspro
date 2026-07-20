import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

const sql = getSql();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {

    // Get tenant id
    const tenant = await sql`SELECT id FROM tenants WHERE slug = ${slug}`;
    if (tenant.length === 0) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const admins = await sql`
      SELECT * FROM tenant_admins
      WHERE tenant_id = ${tenant[0].id}
      ORDER BY created_at DESC
    `;

    return NextResponse.json(admins);
  } catch (error) {
    console.error('Error fetching tenant admins:', error);
    return NextResponse.json({ error: 'Failed to fetch tenant admins' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const body = await request.json();
    const { email, name, role } = body;

    if (!email || !name) {
      return NextResponse.json({ error: 'Missing required fields: email, name' }, { status: 400 });
    }

    // Get tenant id
    const tenant = await sql`SELECT id FROM tenants WHERE slug = ${slug}`;
    if (tenant.length === 0) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const result = await sql`
      INSERT INTO tenant_admins (tenant_id, email, name, role)
      VALUES (${tenant[0].id}, ${email}, ${name}, ${role || 'admin'})
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error creating tenant admin:', error);
    return NextResponse.json({ error: 'Failed to create tenant admin' }, { status: 500 });
  }
}