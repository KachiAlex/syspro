import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { logAuditAction } from '@/lib/audit';
import { getRateLimitKey, checkRateLimitAsync } from '@/lib/rate-limit';
import { BulkTenantIdsSchema, safeParse } from '@/lib/validation';

const sql = getSql();

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (stricter for deletes)
    const key = getRateLimitKey(request);
    const { allowed } = await checkRateLimitAsync(key, 10, 60000);
    if (!allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = await request.json();

    // Validate request body
    const validation = safeParse(BulkTenantIdsSchema, body);
    if (!validation.success) {
      return NextResponse.json({ 
        error: 'Invalid request body', 
        details: validation.error.errors 
      }, { status: 400 });
    }

    const { slugs } = validation.data;

    const res = await sql`
      DELETE FROM tenants
      WHERE slug = ANY(${slugs})
      RETURNING id, slug
    `;

    // Log audit trail for each deleted tenant
    for (const r of res) {
      await logAuditAction('delete', 'tenant', r.id.toString(), { deleted_at: new Date(), count: res.length }, r.slug, request.ip);
    }

    return NextResponse.json(
      { deleted: res.map((r: any) => r.slug) },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store',
        },
      }
    );
  } catch (error) {
    console.error('Error bulk deleting tenants:', error);
    return NextResponse.json({ error: 'Failed to bulk delete tenants' }, { status: 500 });
  }
}
