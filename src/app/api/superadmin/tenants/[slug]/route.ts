export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { requireSuperAdmin } from "@/lib/api-auth";
import { ensureTenantTable } from "@/lib/tenant/tenant-table";
import { logAuditAction } from '@/lib/audit';

const sql = getSql();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
    const _auth = await requireSuperAdmin(request);
    if (!_auth.ok) return _auth.response;

  const { slug } = await params;
  try {
    await ensureTenantTable(sql);
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
  { params }: { params: Promise<{ slug: string }> }
) {
    const _auth = await requireSuperAdmin(request);
    if (!_auth.ok) return _auth.response;

  const { slug } = await params;
  try {
    await ensureTenantTable(sql);
    const body = await request.json();
    const { name, seats, licenseType } = body;

    const result = await sql`
      UPDATE tenants
      SET name = COALESCE(${name}, name),
          seats = COALESCE(${seats}, seats),
          "updatedAt" = NOW()
      WHERE slug = ${slug}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    if (seats !== undefined || licenseType !== undefined) {
      if (licenseType) {
        await sql`
          UPDATE licenses SET
            seats = COALESCE(${seats ?? null}, seats),
            type = ${licenseType},
            updated_at = NOW()
          WHERE tenant_id = ${result[0].id} AND status = 'active'
        `;
      } else if (seats !== undefined) {
        await sql`
          UPDATE licenses SET seats = ${seats}, updated_at = NOW()
          WHERE tenant_id = ${result[0].id} AND status = 'active'
        `;
      }
    }

    await logAuditAction('update', 'tenant', result[0].id.toString(), { slug, fields: Object.keys(body) }, slug, undefined, _auth.user?.id);
    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating tenant:', error);
    return NextResponse.json({ error: 'Failed to update tenant' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
    const _auth = await requireSuperAdmin(request);
    if (!_auth.ok) return _auth.response;

  const { slug } = await params;
  try {
    await ensureTenantTable(sql);
    const result = await sql`DELETE FROM tenants WHERE slug = ${slug} RETURNING *`;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    await logAuditAction('delete', 'tenant', result[0].id.toString(), { slug, name: result[0].name }, slug, undefined, _auth.user?.id);
    return NextResponse.json({ message: 'Tenant deleted' });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    return NextResponse.json({ error: 'Failed to delete tenant' }, { status: 500 });
  }
}