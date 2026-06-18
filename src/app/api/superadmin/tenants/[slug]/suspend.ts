import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

const sql = getSql();

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const result = await sql`
      UPDATE tenants SET status = 'suspended', updated_at = NOW() WHERE slug = ${slug} RETURNING *
    `;
    if (result.length === 0) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Tenant suspended' });
  } catch (error) {
    console.error('Error suspending tenant:', error);
    return NextResponse.json({ error: 'Failed to suspend tenant' }, { status: 500 });
  }
}
