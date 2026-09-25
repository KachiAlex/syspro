import { NextRequest, NextResponse } from "next/server";
import { getPayrollRun, getPayrollEntries } from "@/lib/hr/db";

import { requireModuleAccess } from "@/lib/api-auth";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const _scope = await requireModuleAccess(request, "people", "read");
    if (!_scope.ok) return _scope.response;

  const { id } = await params;
  const tenantSlug = new URL(request.url).searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug required" }, { status: 400 });
  }

  try {
    const run = await getPayrollRun(tenantSlug, id);
    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }

    const entries = await getPayrollEntries(id);
    return NextResponse.json({ run, entries });
  } catch (error) {
    console.error("Failed to get payroll run:", error);
    return NextResponse.json({ error: "Failed to get payroll run" }, { status: 500 });
  }
}
