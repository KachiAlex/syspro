export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { z } from 'zod';
import { requireSuperAdmin } from "@/lib/api-auth";
import { ensurePricingTable, getAllPricingPlans } from "@/lib/pricing/plans";

const sql = getSql();

const planSchema = z.object({
  key: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Key must be lowercase letters, numbers, and hyphens'),
  name: z.string().min(1).max(100),
  tagline: z.string().max(500).optional().default(''),
  price_label: z.string().max(50).nullable().optional(),
  price_monthly: z.number().min(0).nullable().optional(),
  price_annual: z.number().min(0).nullable().optional(),
  currency: z.string().min(1).max(3).default('NGN'),
  period_label: z.string().max(20).default('/month'),
  max_users: z.number().int().min(1).nullable().optional(),
  features: z.array(z.string()).default([]),
  cta_label: z.string().max(50).default('Get started'),
  cta_href: z.string().max(200).default('/signup'),
  is_featured: z.boolean().default(false),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0),
});

export async function GET(request: NextRequest) {
    const _auth = await requireSuperAdmin(request);
    if (!_auth.ok) return _auth.response;

  try {
    const plans = await getAllPricingPlans();
    return NextResponse.json(plans);
  } catch (error) {
    console.error('Error fetching pricing plans:', error);
    return NextResponse.json({ error: 'Failed to fetch pricing plans' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
    const _auth = await requireSuperAdmin(request);
    if (!_auth.ok) return _auth.response;

  try {
    const body = await request.json();
    const parsed = planSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 });
    }

    const d = parsed.data;
    await ensurePricingTable(sql);

    const result = await sql`
      INSERT INTO pricing_plans (
        key, name, tagline, price_label, price_monthly, price_annual,
        currency, period_label, max_users, features, cta_label, cta_href,
        is_featured, is_active, sort_order
      )
      VALUES (
        ${d.key}, ${d.name}, ${d.tagline}, ${d.price_label ?? null},
        ${d.price_monthly ?? null}, ${d.price_annual ?? null},
        ${d.currency}, ${d.period_label}, ${d.max_users ?? null},
        ${JSON.stringify(d.features)}::jsonb, ${d.cta_label}, ${d.cta_href},
        ${d.is_featured}, ${d.is_active}, ${d.sort_order}
      )
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating pricing plan:', error);
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'A plan with this key already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create pricing plan' }, { status: 500 });
  }
}
