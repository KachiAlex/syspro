export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { AuditLogsQuerySchema, safeParse } from '@/lib/validation';
import { requireSuperAdmin } from "@/lib/api-auth";

const sql = getSql();

/**
 * Unified platform audit feed.
 * Merges platform-level `audit_logs` (superadmin ops: licenses, tenants,
 * pricing) with per-tenant `admin_audit_logs` (tenant admin activity).
 * Normalized row shape:
 *   { id, source, tenantSlug, actor, action, resource, resourceId, detail, ip, createdAt }
 */
export async function GET(request: NextRequest) {
    const _auth = await requireSuperAdmin(request);
    if (!_auth.ok) return _auth.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '50',
      action: searchParams.get('action') || undefined,
      entitySlug: searchParams.get('entitySlug') || undefined,
    };

    const validation = safeParse(AuditLogsQuerySchema, queryParams);
    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid query parameters',
        details: validation.error.errors
      }, { status: 400 });
    }

    const { page, limit } = validation.data;
    const tenant = (searchParams.get('tenant') || '').trim() || null;
    const actionFilter = (searchParams.get('action') || '').trim() || null;
    const source = (searchParams.get('source') || 'all').toLowerCase(); // all | platform | tenant
    const offset = (page! - 1) * limit!;
    const cappedLimit = Math.min(limit!, 200);

    const platformRows = source === 'tenant' ? [] : await sql`
      SELECT l.id::text AS id,
             'platform' AS source,
             t.slug AS tenant_slug,
             l.actor_id AS actor,
             l.action,
             l.target_table AS resource,
             l.target_id AS resource_id,
             l.diff AS detail,
             NULL AS ip,
             l.created_at
      FROM audit_logs l
      LEFT JOIN tenants t ON t.id = l.tenant_id
      WHERE (${tenant}::text IS NULL OR t.slug = ${tenant})
        AND (${actionFilter}::text IS NULL OR l.action ILIKE '%' || ${actionFilter} || '%')
      ORDER BY l.created_at DESC
      LIMIT 500
    `;

    const tenantRows = source === 'platform' ? [] : await sql`
      SELECT a.id::text AS id,
             'tenant' AS source,
             a.tenant_slug,
             a.user_id AS actor,
             a.action,
             a.resource,
             a.resource_id,
             a.changes AS detail,
             a.ip_address AS ip,
             a.created_at
      FROM admin_audit_logs a
      WHERE (${tenant}::text IS NULL OR a.tenant_slug = ${tenant})
        AND (${actionFilter}::text IS NULL OR a.action ILIKE '%' || ${actionFilter} || '%')
      ORDER BY a.created_at DESC
      LIMIT 500
    `;

    const merged = [...(platformRows as any[]), ...(tenantRows as any[])]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const total = merged.length;
    const items = merged.slice(offset, offset + cappedLimit).map((r) => ({
      id: r.id,
      source: r.source,
      tenantSlug: r.tenant_slug,
      actor: r.actor,
      action: r.action,
      resource: r.resource,
      resourceId: r.resource_id,
      detail: r.detail,
      ip: r.ip,
      createdAt: r.created_at,
    }));

    return NextResponse.json({ items, page, limit: cappedLimit, total }, {
      headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
