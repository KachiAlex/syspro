import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

const sql = getSql();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slugs } = body;

    if (!Array.isArray(slugs) || slugs.length === 0) {
      return NextResponse.json({ error: 'Missing or invalid slugs array' }, { status: 400 });
    }

    // Fetch admins for tenants (grouped by tenant_id)
    const tenants = await sql`
      SELECT id, slug FROM tenants WHERE slug IN (${slugs.join(',')})
    `;

    const tenantIds = tenants.map((t: any) => t.id);

    if (tenantIds.length === 0) {
      return NextResponse.json({});
    }

    const admins = await sql`
      SELECT a.*, t.slug as tenant_slug, t.name as tenant_name 
      FROM tenant_admins a
      JOIN tenants t ON a.tenant_id = t.id
      WHERE a.tenant_id = ANY(${tenantIds})
      ORDER BY a.created_at DESC
    `;

    // Group by tenant_slug
    const grouped: Record<string, any[]> = {};
    slugs.forEach((slug: string) => {
      grouped[slug] = [];
    });
    admins.forEach((admin: any) => {
      if (grouped[admin.tenant_slug]) {
        grouped[admin.tenant_slug].push(admin);
      }
    });

    return NextResponse.json(grouped, {
      headers: {
        'Cache-Control': 'private, max-age=30',
      },
    });
  } catch (error) {
    console.error('Error fetching batch admins:', error);
    return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 });
  }
}
