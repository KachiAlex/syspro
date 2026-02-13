import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const cwd = process.cwd();
    const pid = process.pid;
    const nodeVersion = process.version;
    return NextResponse.json({ ok: true, cwd, pid, nodeVersion });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[server-info] error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
