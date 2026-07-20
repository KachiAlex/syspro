import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

const sql = getSql();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const result = await sql`
      UPDATE tenants SET status = 'suspended', "isActive" = false, updated_at = NOW() WHERE slug = ${slug} RETURNING *
    `;
    if (result.length === 0) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Tenant suspended', tenant: result[0] });
  } catch (error) {
    console.error('Error suspending tenant:', error);
    return NextResponse.json({ error: 'Failed to suspend tenant' }, { status: 500 });
  }
}
