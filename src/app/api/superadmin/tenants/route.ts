export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSql } from '@/lib/db';
import { TenantPaginationSchema, CreateTenantSchema, safeParse } from '@/lib/validation';
import { requireSuperAdmin } from "@/lib/api-auth";
import { ensureTenantTable } from "@/lib/tenant/tenant-table";
import { getTableColumns } from "@/lib/schema-inspect";
import { db } from "@/lib/sql-client";

const sql = getSql();

export async function GET(request: NextRequest) {
    const _auth = await requireSuperAdmin(request);
    if (!_auth.ok) return _auth.response;

  try {
    await ensureTenantTable(sql);
    const url = new URL(request.url);
    const queryParams = {
      page: url.searchParams.get('page') || '1',
      limit: url.searchParams.get('limit') || '20',
      q: url.searchParams.get('q') || '',
    };

    // Validate query parameters
    const validation = safeParse(TenantPaginationSchema, queryParams);
    if (!validation.success) {
      return NextResponse.json({ 
        error: 'Invalid query parameters', 
        details: validation.error.errors 
      }, { status: 400 });
    }

    const { page, limit, q } = validation.data;
    const offset = (Math.max(page!, 1) - 1) * limit!;

    let items;
    if (q) {
      const like = `%${q}%`;
      items = await sql`
        SELECT * FROM tenants
        WHERE name ILIKE ${like} OR slug ILIKE ${like}
        ORDER BY "createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      items = await sql`
        SELECT * FROM tenants
        ORDER BY "createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    let total: number;
    if (q) {
      const like = `%${q}%`;
      const countRes = await sql`
        SELECT COUNT(*) AS total FROM tenants
        WHERE name ILIKE ${like} OR slug ILIKE ${like}
      `;
      total = parseInt(countRes[0]?.total || '0', 10);
    } else {
      const countRes = await sql`
        SELECT COUNT(*) AS total FROM tenants
      `;
      total = parseInt(countRes[0]?.total || '0', 10);
    }

    // Never expose credential material to the list API — the superadmin UI
    // does not render it, and a leaked hash enables offline cracking.
    const sanitized = (items as any[]).map(({ admin_password_hash, ...rest }) => rest);
    return NextResponse.json({ items: sanitized, total });
  } catch (error) {
    console.error('Error fetching tenants:', error);
    return NextResponse.json({ error: 'Failed to fetch tenants' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
    const _auth = await requireSuperAdmin(request);
    if (!_auth.ok) return _auth.response;

  try {
    const body = await request.json();

    // Validate request body
    const validation = safeParse(CreateTenantSchema, body);
    if (!validation.success) {
      return NextResponse.json({ 
        error: 'Invalid request body', 
        details: validation.error.errors 
      }, { status: 400 });
    }

    const { name, slug, seats } = validation.data;

    await ensureTenantTable(sql);

    const tenantCols = await getTableColumns("tenants");
    const tenantValues: Record<string, unknown> = { name, slug, seats };
    if (tenantCols.get("id")?.dataType === "uuid") tenantValues.id = randomUUID();

    const entries = Object.entries(tenantValues).filter(([c]) => tenantCols.has(c));
    const colList = entries.map(([c]) => `"${c}"`).join(", ");
    const placeholders = entries.map((_, i) => `$${i + 1}`).join(", ");
    const res = await db.query<any>(
      `insert into tenants (${colList}) values (${placeholders}) returning *`,
      entries.map(([, v]) => v)
    );

    const { admin_password_hash, ...created } = res.rows[0] as any;
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error creating tenant:', error);
    return NextResponse.json({ error: 'Failed to create tenant' }, { status: 500 });
  }
}