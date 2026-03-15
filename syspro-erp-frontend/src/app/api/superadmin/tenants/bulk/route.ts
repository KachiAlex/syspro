import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

const sql = getSql();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, slugs } = body;

    if (!action || !Array.isArray(slugs) || slugs.length === 0) {
      return NextResponse.json({ error: 'Missing or invalid action and slugs' }, { status: 400 });
    }

    const placeholders = slugs.map((_, i) => `$${i + 1}`).join(',');

    if (action === 'activate') {
      await sql.unsafe(`
        UPDATE tenants SET status = 'active', updated_at = NOW() 
        WHERE slug IN (${placeholders})
      `, slugs);
      return NextResponse.json({ message: `Activated ${slugs.length} tenants` });
    }

    if (action === 'suspend') {
      await sql.unsafe(`
        UPDATE tenants SET status = 'suspended', updated_at = NOW() 
        WHERE slug IN (${placeholders})
      `, slugs);
      return NextResponse.json({ message: `Suspended ${slugs.length} tenants` });
    }

    if (action === 'delete') {
      await sql.unsafe(`
        DELETE FROM tenants WHERE slug IN (${placeholders})
      `, slugs);
      return NextResponse.json({ message: `Deleted ${slugs.length} tenants` });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in bulk operation:', error);
    return NextResponse.json({ error: 'Failed to perform bulk operation' }, { status: 500 });
  }
}
