export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireModuleGate } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const gate = await requireModuleGate(request, "people", "read");
  if (gate) return gate;
  const tenantSlug = new URL(request.url).searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug required" }, { status: 400 });
  }
  return NextResponse.json({ trainingSessions: [] });
}
