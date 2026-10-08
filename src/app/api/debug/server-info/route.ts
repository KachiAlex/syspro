export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';

export async function GET(request: Request) {
  const auth = await requireSuperAdmin(request as any);
  if (!auth.ok) return auth.response;
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
