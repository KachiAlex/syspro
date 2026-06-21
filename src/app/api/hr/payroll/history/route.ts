import { NextRequest, NextResponse } from "next/server";
import { listPayrollRuns } from "@/lib/hr/db";

export async function GET(request: NextRequest) {
  const tenantSlug = new URL(request.url).searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug required" }, { status: 400 });
  }

  try {
    const runs = await listPayrollRuns(tenantSlug);
    return NextResponse.json({ payrollHistory: runs });
  } catch (error) {
    console.error("Failed to list payroll history:", error);
    return NextResponse.json({ error: "Failed to list payroll history" }, { status: 500 });
  }
}
