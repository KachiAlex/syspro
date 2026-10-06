export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { requireSuperAdmin } from "@/lib/api-auth";
import { ensureTenantTable } from "@/lib/tenant/tenant-table";

const sql = getSql();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
    const _auth = await requireSuperAdmin(request);
    if (!_auth.ok) return _auth.response;

  const { slug } = await params;
  try {
    await ensureTenantTable(sql);
    const result = await sql`
      UPDATE tenants SET status = 'active', "isActive" = true, "updatedAt" = NOW() WHERE slug = ${slug} RETURNING *
    `;
    if (result.length === 0) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Tenant activated', tenant: result[0] });
  } catch (error) {
    console.error('Error activating tenant:', error);
    return NextResponse.json({ error: 'Failed to activate tenant' }, { status: 500 });
  }
}
