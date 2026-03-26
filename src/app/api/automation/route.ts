import { NextResponse } from 'next/server';
// Importing automation code from the repo root; TypeScript may not resolve this
// path in the frontend project, so keep a runtime import and ignore TS here.
// @ts-ignore
import { eventBus } from '../../../../src/lib/automation/event-bus';

export async function GET() {
  return NextResponse.json({ ok: true, module: 'automation', version: '0.1.0' });
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (!body?.type) {
    return NextResponse.json({ error: 'missing event type' }, { status: 400 });
  }

  eventBus.publish({ type: body.type, payload: body.payload ?? {} });
  return NextResponse.json({ accepted: true }, { status: 202 });
}
