import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const tenantSlug = new URL(request.url).searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug required" }, { status: 400 });
  }
  return NextResponse.json({ payrollHistory: [] });
}
