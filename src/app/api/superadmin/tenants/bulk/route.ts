export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { requireSuperAdmin } from "@/lib/api-auth";
import { ensureTenantTable } from "@/lib/tenant/tenant-table";
import { logAuditAction } from '@/lib/audit';

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

    if (action === 'activate' || action === 'suspend') {
      const status = action === 'activate' ? 'active' : 'suspended';
      const res = await sql.query(
        `UPDATE tenants SET status = '${status}', "isActive" = ${action === 'activate'}, "updatedAt" = NOW() WHERE slug IN (${placeholders}) RETURNING id, slug`,
        slugs
      );
      for (const r of res.rows || []) {
        await logAuditAction(action, 'tenant', r.id.toString(), { count: res.rowCount }, r.slug, undefined, _auth.user?.id);
      }
      return NextResponse.json({ message: `${action === 'activate' ? 'Activated' : 'Suspended'} ${res.rowCount ?? slugs.length} tenants`, updated: (res.rows || []).map((r: any) => r.slug) });
    }

    if (action === 'delete') {
      const res = await sql.query(
        `DELETE FROM tenants WHERE slug IN (${placeholders}) RETURNING id, slug`,
        slugs
      );
      for (const r of res.rows || []) {
        await logAuditAction('delete', 'tenant', r.id.toString(), { count: res.rowCount }, r.slug, undefined, _auth.user?.id);
      }
      return NextResponse.json({ message: `Deleted ${res.rowCount ?? slugs.length} tenants`, deleted: (res.rows || []).map((r: any) => r.slug) });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in bulk operation:', error);
    return NextResponse.json({ error: 'Failed to perform bulk operation' }, { status: 500 });
  }
}
