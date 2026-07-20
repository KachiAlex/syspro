import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { TenantPaginationSchema, CreateTenantSchema, safeParse } from '@/lib/validation';

const sql = getSql();

export async function GET(request: NextRequest) {
  try {
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
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      items = await sql`
        SELECT * FROM tenants
        ORDER BY created_at DESC
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

    return NextResponse.json({ items, total });
  } catch (error) {
    console.error('Error fetching tenants:', error);
    return NextResponse.json({ error: 'Failed to fetch tenants' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    const result = await sql`
      INSERT INTO tenants (name, slug, seats)
      VALUES (${name}, ${slug}, ${seats})
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error creating tenant:', error);
    return NextResponse.json({ error: 'Failed to create tenant' }, { status: 500 });
  }
}