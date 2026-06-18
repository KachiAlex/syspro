import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

const sql = getSql();

export async function POST(request: NextRequest) {
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
