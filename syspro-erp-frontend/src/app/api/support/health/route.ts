import { NextResponse } from 'next/server';
import { getTenantSupportData } from '@/lib/support-data';

export async function GET(request: Request) {
  try {
    // Return a short summary of seeded tenants and counts for quick debugging from the running server
    // Note: this reads the in-memory store used by the support APIs.
    // WARNING: Do not enable in production.
    // Build list of tenants by attempting common keys (seed creates many on demand)
    const tenants = Object.keys((require('@/lib/support-data') as any).store || {});
    const summary = tenants.map((t) => {
      try {
        const data = getTenantSupportData(t as string);
        return {
          tenant: t,
          tickets: data.tickets.length,
          engineers: data.engineers.length,
          incidents: data.incidents.length,
        };
      } catch (e) {
        return { tenant: t, error: String(e) };
      }
    });

    return NextResponse.json({ ok: true, tenants: summary });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[Support Health] error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
