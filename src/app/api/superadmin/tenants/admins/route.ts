import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { requireSuperAdmin } from "@/lib/api-auth";

const sql = getSql();

export async function POST(request: NextRequest) {
    const _auth = await requireSuperAdmin(request);
    if (!_auth.ok) return _auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const slugs: string[] = body?.slugs || [];

    if (Array.isArray(slugs) && slugs.length > 0) {
      const admins = await sql`
        SELECT ta.*, t.slug as tenant_slug, t.name as tenant_name
        FROM tenant_admins ta
        JOIN tenants t ON ta.tenant_id = t.id
        WHERE t.slug = ANY(${slugs})
        ORDER BY ta.created_at DESC
      `;
      return NextResponse.json(admins);
    }

    // If no slugs provided, return all admins
    const admins = await sql`
      SELECT ta.*, t.slug as tenant_slug, t.name as tenant_name
      FROM tenant_admins ta
      JOIN tenants t ON ta.tenant_id = t.id
      ORDER BY ta.created_at DESC
    `;
    return NextResponse.json(admins);
  } catch (error) {
    console.error('Error fetching tenant admins:', error);
    return NextResponse.json({ error: 'Failed to fetch tenant admins' }, { status: 500 });
  }
}
