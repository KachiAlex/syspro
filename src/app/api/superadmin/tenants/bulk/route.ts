import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { requireSuperAdmin } from "@/lib/api-auth";
import { ensureTenantTable } from "@/lib/tenant/tenant-table";

const sql = getSql();

export async function POST(request: NextRequest) {
    const _auth = await requireSuperAdmin(request);
    if (!_auth.ok) return _auth.response;

  try {
    await ensureTenantTable(sql);
    const body = await request.json();
    const { action, slugs } = body;

    if (!action || !Array.isArray(slugs) || slugs.length === 0) {
      return NextResponse.json({ error: 'Missing or invalid action and slugs' }, { status: 400 });
    }

    const placeholders = slugs.map((_, i) => `$${i + 1}`).join(',');

    if (action === 'activate') {
      await sql.query(
        `UPDATE tenants SET status = 'active', "updatedAt" = NOW() WHERE slug IN (${placeholders})`,
        slugs
      );
      return NextResponse.json({ message: `Activated ${slugs.length} tenants` });
    }

    if (action === 'suspend') {
      await sql.query(
        `UPDATE tenants SET status = 'suspended', "updatedAt" = NOW() WHERE slug IN (${placeholders})`,
        slugs
      );
      return NextResponse.json({ message: `Suspended ${slugs.length} tenants` });
    }

    if (action === 'delete') {
      await sql.query(
        `DELETE FROM tenants WHERE slug IN (${placeholders})`,
        slugs
      );
      return NextResponse.json({ message: `Deleted ${slugs.length} tenants` });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in bulk operation:', error);
    return NextResponse.json({ error: 'Failed to perform bulk operation' }, { status: 500 });
  }
}
