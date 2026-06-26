import { NextRequest, NextResponse } from "next/server";
import { listStaffReports } from "@/lib/hr/db";

export async function GET(request: NextRequest) {
  const tenantSlug = new URL(request.url).searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug required" }, { status: 400 });
  }
  try {
    const reports = await listStaffReports(tenantSlug);
    return NextResponse.json({ reports });
  } catch (error) {
    console.error("Error fetching hr reports:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
