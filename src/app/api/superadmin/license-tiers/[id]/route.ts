import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { z } from 'zod';

const sql = getSql();

const updateSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  min_seats: z.number().int().min(1).max(100000).optional(),
  max_seats: z.number().int().min(1).max(100000).optional(),
  default_seats: z.number().int().min(1).max(100000).optional(),
  price_per_seat: z.number().min(0).max(10000).optional(),
  currency: z.string().min(1).max(3).optional(),
  billing_cycle: z.enum(['monthly', 'annual', 'custom']).optional(),
  features: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const tier = await sql`SELECT * FROM license_tiers WHERE id = ${parseInt(id, 10)}`;
    if (tier.length === 0) {
      return NextResponse.json({ error: 'License tier not found' }, { status: 404 });
    }
    return NextResponse.json(tier[0]);
  } catch (error) {
    console.error('Error fetching license tier:', error);
    return NextResponse.json({ error: 'Failed to fetch license tier' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 });
    }

    const d = parsed.data;
    const featuresJson = d.features ? JSON.stringify(d.features) : undefined;

    const result = await sql`
      UPDATE license_tiers SET
        label = COALESCE(${d.label}, label),
        description = COALESCE(${d.description}, description),
        min_seats = COALESCE(${d.min_seats}, min_seats),
        max_seats = COALESCE(${d.max_seats}, max_seats),
        default_seats = COALESCE(${d.default_seats}, default_seats),
        price_per_seat = COALESCE(${d.price_per_seat}, price_per_seat),
        currency = COALESCE(${d.currency}, currency),
        billing_cycle = COALESCE(${d.billing_cycle}, billing_cycle),
        features = COALESCE(${featuresJson ? sql`${featuresJson}::jsonb` : sql`NULL`}, features),
        is_active = COALESCE(${d.is_active}, is_active),
        sort_order = COALESCE(${d.sort_order}, sort_order),
        updated_at = NOW()
      WHERE id = ${parseInt(id, 10)}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'License tier not found' }, { status: 404 });
    }
    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating license tier:', error);
    return NextResponse.json({ error: 'Failed to update license tier' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const result = await sql`DELETE FROM license_tiers WHERE id = ${parseInt(id, 10)} RETURNING id`;
    if (result.length === 0) {
      return NextResponse.json({ error: 'License tier not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting license tier:', error);
    return NextResponse.json({ error: 'Failed to delete license tier' }, { status: 500 });
  }
}
