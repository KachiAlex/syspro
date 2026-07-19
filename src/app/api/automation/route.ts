import { NextRequest, NextResponse } from 'next/server';
import { extractAuthContext, validateTenant, requirePermission } from '@/lib/auth-helper';
import { executeRulesForEvent } from '@/lib/automation/engine';

export async function GET() {
  return NextResponse.json({ ok: true, module: 'automation', version: '0.1.0' });
}

export async function POST(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, 'write');

    let body: any;
    try {
      body = await request.json();
    } catch (err) {
      return NextResponse.json({ error: 'invalid json' }, { status: 400 });
    }

    if (!body?.type) {
      return NextResponse.json({ error: 'missing event type' }, { status: 400 });
    }

    const simulation = Boolean(body.simulation);
    const results = await executeRulesForEvent(
      tenantSlug,
      {
        type: body.type,
        payload: body.payload ?? {},
        actor: body.actor || auth.userId,
      },
      simulation
    );

    return NextResponse.json({ accepted: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to process automation event';
    return NextResponse.json({ error: message }, { status: message.includes('Unauthorized') ? 403 : 500 });
  }
}
