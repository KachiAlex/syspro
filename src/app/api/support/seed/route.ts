import { NextResponse } from 'next/server';
import { createTicket, getTenantSupportData } from '@/lib/support-data';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const tenantSlug = (body?.tenantSlug as string) || 'kreatix-default';

    // Ensure tenant data exists
    getTenantSupportData(tenantSlug);

    const samples = [
      {
        title: 'Sample: Customer site down',
        description: 'Customer reports complete outage at site',
        ticketType: 'customer',
        source: 'crm',
        impactLevel: 'critical',
        priority: 'critical',
      },
      {
        title: 'Sample: VPN auth failures',
        description: 'Multiple users unable to authenticate to VPN',
        ticketType: 'internal',
        source: 'erp',
        impactLevel: 'high',
        priority: 'high',
      },
      {
        title: 'Sample: Last-mile degradation',
        description: 'Intermittent packet loss reported by monitoring',
        ticketType: 'customer',
        source: 'monitoring',
        impactLevel: 'medium',
        priority: 'medium',
      },
    ];

    const created: any[] = [];
    for (const s of samples) {
      try {
        const t = createTicket({
          tenantSlug,
          title: s.title,
          description: s.description,
          ticketType: s.ticketType as any,
          source: s.source as any,
          impactLevel: s.impactLevel as any,
          priority: s.priority as any,
          createdBy: 'seed-script',
        });
        created.push(t);
      } catch (e) {
        // continue
      }
    }

    return NextResponse.json({ ok: true, tenant: tenantSlug, createdCount: created.length, tickets: created });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[Support Seed] error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
