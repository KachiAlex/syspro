import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const { searchParams } = new URL(request.url);
  const tenantSlug = context.tenantSlug;

  return NextResponse.json({ attendance: [] });
}

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  const { employeeId, employeeName, date, status } = body;
  const tenantSlug = context.tenantSlug;

  if (!employeeId || !employeeName || !date || !status) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const newRecord = {
    id: `att-${Date.now()}`,
    tenantSlug,
    employeeId,
    employeeName,
    date,
    status,
  };

  return NextResponse.json(
    { attendance: newRecord, message: "Attendance recorded successfully" },
    { status: 201 }
  );
}
