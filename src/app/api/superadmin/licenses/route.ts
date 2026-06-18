import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

const sql = getSql();

export async function GET() {
  try {
    const licenses = await sql`
      SELECT l.*, t.name as tenant_name, t.slug as tenant_slug
      FROM licenses l
      JOIN tenants t ON l.tenant_id = t.id
      ORDER BY l.created_at DESC
    `;
    return NextResponse.json(licenses);
  } catch (error) {
    console.error('Error fetching licenses:', error);
    return NextResponse.json({ error: 'Failed to fetch licenses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantSlug, type, seats, expiry } = body;

    if (!tenantSlug || !type || !seats) {
      return NextResponse.json({ error: 'Missing required fields: tenantSlug, type, seats' }, { status: 400 });
    }

    // Get tenant id from slug
    const tenant = await sql`SELECT id FROM tenants WHERE slug = ${tenantSlug}`;
    if (tenant.length === 0) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const result = await sql`
      INSERT INTO licenses (tenant_id, type, seats, expiry)
      VALUES (${tenant[0].id}, ${type}, ${seats}, ${expiry})
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error creating license:', error);
    return NextResponse.json({ error: 'Failed to create license' }, { status: 500 });
  }
}