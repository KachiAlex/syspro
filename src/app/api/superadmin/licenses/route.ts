import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { CreateLicenseSchema, safeParse, LICENSE_TIERS } from '@/lib/validation';
import { randomUUID } from 'crypto';

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

    const validation = safeParse(CreateLicenseSchema, body);
    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid request body',
        details: validation.error.errors,
      }, { status: 400 });
    }

    const { tenantSlug, type, seats, expiry } = validation.data;

    const tenant = await sql`SELECT id FROM tenants WHERE slug = ${tenantSlug}`;
    if (tenant.length === 0) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const licenseKey = `PISAIRTEL-${type.toUpperCase()}-${tenantSlug.toUpperCase()}-${randomUUID().slice(0, 8)}`;
    const expiryDate = expiry ? expiry.slice(0, 10) : null;

    const result = await sql`
      INSERT INTO licenses (tenant_id, license_key, type, seats, status, expiry, created_at)
      VALUES (${tenant[0].id}, ${licenseKey}, ${type}, ${seats}, 'active', ${expiryDate}, now())
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error creating license:', error);
    return NextResponse.json({ error: 'Failed to create license' }, { status: 500 });
  }
}