import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

const sql = getSql();

export async function GET() {
  try {
    const tenants = await sql`SELECT * FROM tenants ORDER BY created_at DESC`;
    return NextResponse.json(tenants);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    return NextResponse.json({ error: 'Failed to fetch tenants' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, slug, seats } = body;

    if (!name || !slug || !seats) {
      return NextResponse.json({ error: 'Missing required fields: name, slug, seats' }, { status: 400 });
    }

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