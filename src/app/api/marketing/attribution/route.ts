import { NextResponse } from "next/server";
import { calculateAttributionForTenant } from "@/lib/marketing/service";

export async function GET(request: Request) {
  try {
    const tenant = request.headers.get('x-tenant') || 'default';
    const url = new URL(request.url);
    const model = (url.searchParams.get('model') as any) || 'first_touch';
    const from = url.searchParams.get('from') || undefined;
    const to = url.searchParams.get('to') || undefined;
    const res = await calculateAttributionForTenant(tenant, model, from, to);
    return NextResponse.json(res);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'unable to calculate attribution' }, { status: 500 });
  }
}
