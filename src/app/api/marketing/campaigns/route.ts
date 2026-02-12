import { NextResponse } from "next/server";
import { listCampaigns, createCampaign } from "@/lib/marketing/service";

export async function GET(request: Request) {
  try {
    const tenant = (request.headers.get("x-tenant") || "default");
    const rows = await listCampaigns(tenant);
    return NextResponse.json({ campaigns: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'unable to list campaigns' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const tenant = (request.headers.get("x-tenant") || "default");
    const body = await request.json();
    const created = await createCampaign(tenant, body, request.headers.get('x-user') || undefined);
    return NextResponse.json({ campaign: created }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'unable to create campaign' }, { status: 500 });
  }
}
