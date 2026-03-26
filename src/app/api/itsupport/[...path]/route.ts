import { NextRequest, NextResponse } from 'next/server';

// Compatibility proxy: forward /api/itsupport/* -> /api/support/* on same origin
export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const path = params.path?.join('/') || '';
    const url = new URL(request.url);
    const target = `${url.protocol}//${url.host}/api/support/${path}${url.search}`;

    const init: RequestInit = {
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer().then((b) => Buffer.from(b)),
      redirect: 'manual',
    };

    const res = await fetch(target, init);
    const headers = new Headers(res.headers);
    // Remove hop-by-hop headers if present
    headers.delete('connection');
    const body = await res.arrayBuffer();
    return new NextResponse(body.length ? Buffer.from(body) : null, { status: res.status, headers });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[itsupport proxy] error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return GET(request, { params });
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return GET(request, { params });
}

export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } }) {
  return GET(request, { params });
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return GET(request, { params });
}

export async function OPTIONS(request: NextRequest, { params }: { params: { path: string[] } }) {
  return GET(request, { params });
}
