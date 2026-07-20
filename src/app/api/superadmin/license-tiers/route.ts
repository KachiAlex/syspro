import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { z } from 'zod';

const sql = getSql();

const tierSchema = z.object({
  key: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Key must be lowercase letters, numbers, and hyphens'),
  label: z.string().min(1).max(100),
  description: z.string().max(1000).optional().default(''),
  min_seats: z.number().int().min(1).max(100000),
  max_seats: z.number().int().min(1).max(100000),
  default_seats: z.number().int().min(1).max(100000),
  price_per_seat: z.number().min(0).max(10000),
  currency: z.string().min(1).max(3).default('USD'),
  billing_cycle: z.enum(['monthly', 'annual', 'custom']).default('monthly'),
  features: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0),
});

export async function GET() {
  try {
    const tiers = await sql`
      SELECT * FROM license_tiers ORDER BY sort_order ASC, id ASC
    `;
    return NextResponse.json(tiers);
  } catch (error) {
    console.error('Error fetching license tiers:', error);
    return NextResponse.json({ error: 'Failed to fetch license tiers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = tierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 });
    }

    const d = parsed.data;
    const featuresJson = JSON.stringify(d.features);

    const result = await sql`
      INSERT INTO license_tiers (key, label, description, min_seats, max_seats, default_seats, price_per_seat, currency, billing_cycle, features, is_active, sort_order)
      VALUES (${d.key}, ${d.label}, ${d.description}, ${d.min_seats}, ${d.max_seats}, ${d.default_seats}, ${d.price_per_seat}, ${d.currency}, ${d.billing_cycle}, ${featuresJson}::jsonb, ${d.is_active}, ${d.sort_order})
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating license tier:', error);
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'A tier with this key already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create license tier' }, { status: 500 });
  }
}
