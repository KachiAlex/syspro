import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import bcrypt from 'bcryptjs';

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
    const { email, name, role, password } = body;

    if (!email || !name) {
      return NextResponse.json({ error: 'Missing required fields: email, name' }, { status: 400 });
    }

    // Get tenant id
    const tenant = await sql`SELECT id FROM tenants WHERE slug = ${slug}`;
    if (tenant.length === 0) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Hash password if provided, otherwise try to copy from tenants.admin_password_hash
    let passwordHash: string | null = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 12);
    } else {
      const tenantRow = await sql`SELECT admin_password_hash FROM tenants WHERE slug = ${slug}`;
      if (tenantRow.length > 0 && tenantRow[0].admin_password_hash) {
        passwordHash = tenantRow[0].admin_password_hash;
      }
    }

    const result = await sql`
      INSERT INTO tenant_admins (tenant_id, email, name, role, password_hash)
      VALUES (${tenant[0].id}, ${email.toLowerCase()}, ${name}, ${role || 'admin'}, ${passwordHash})
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error creating tenant admin:', error);
    return NextResponse.json({ error: 'Failed to create tenant admin' }, { status: 500 });
  }
}