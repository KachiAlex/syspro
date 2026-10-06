export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { z } from 'zod';
import { requireSuperAdmin } from "@/lib/api-auth";
import { db } from "@/lib/sql-client";
import { ensurePricingTable } from "@/lib/pricing/plans";

const sql = getSql();

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  tagline: z.string().max(500).optional(),
  price_label: z.string().max(50).nullable().optional(),
  price_monthly: z.number().min(0).nullable().optional(),
  price_annual: z.number().min(0).nullable().optional(),
  currency: z.string().min(1).max(3).optional(),
  period_label: z.string().max(20).optional(),
  max_users: z.number().int().min(1).nullable().optional(),
  features: z.array(z.string()).optional(),
  cta_label: z.string().max(50).optional(),
  cta_href: z.string().max(200).optional(),
  is_featured: z.boolean().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
});

// Only these columns may ever be written by PATCH — keeps the dynamic SET
// clause safe against unexpected keys.
const UPDATABLE = [
  'name', 'tagline', 'price_label', 'price_monthly', 'price_annual',
  'currency', 'period_label', 'max_users', 'features', 'cta_label',
  'cta_href', 'is_featured', 'is_active', 'sort_order',
] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const _auth = await requireSuperAdmin(request);
    if (!_auth.ok) return _auth.response;

  const { id } = await params;
  try {
    const plan = await sql`SELECT * FROM pricing_plans WHERE id = ${parseInt(id, 10)}`;
    if (plan.length === 0) {
      return NextResponse.json({ error: 'Pricing plan not found' }, { status: 404 });
    }
    return NextResponse.json(plan[0]);
  } catch (error) {
    console.error('Error fetching pricing plan:', error);
    return NextResponse.json({ error: 'Failed to fetch pricing plan' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const _auth = await requireSuperAdmin(request);
    if (!_auth.ok) return _auth.response;

  const { id } = await params;
  try {
    await ensurePricingTable(sql);
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 });
    }

    // Presence-based update: a field explicitly sent as null (e.g. making a
    // plan's price "Custom") must write NULL, so COALESCE won't work here.
    const d = parsed.data as Record<string, unknown>;
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const col of UPDATABLE) {
      if (!Object.prototype.hasOwnProperty.call(d, col)) continue;
      params.push(col === 'features' ? JSON.stringify(d[col]) : d[col]);
      sets.push(`"${col}" = $${params.length}${col === 'features' ? '::jsonb' : ''}`);
    }
    if (sets.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    params.push(parseInt(id, 10));
    const res = await db.query(
      `UPDATE pricing_plans SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
      params
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Pricing plan not found' }, { status: 404 });
    }
    return NextResponse.json(res.rows[0]);
  } catch (error) {
    console.error('Error updating pricing plan:', error);
    return NextResponse.json({ error: 'Failed to update pricing plan' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const _auth = await requireSuperAdmin(request);
    if (!_auth.ok) return _auth.response;

  const { id } = await params;
  try {
    const result = await sql`DELETE FROM pricing_plans WHERE id = ${parseInt(id, 10)} RETURNING id`;
    if (result.length === 0) {
      return NextResponse.json({ error: 'Pricing plan not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting pricing plan:', error);
    return NextResponse.json({ error: 'Failed to delete pricing plan' }, { status: 500 });
  }
}
