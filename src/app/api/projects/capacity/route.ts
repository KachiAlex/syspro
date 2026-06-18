import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  return NextResponse.json({ capacity: [] });
}

export async function PUT(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  const {
    department,
    weekOf,
    availableHours,
    assignedHours,
    utilization,
    underUtilized,
  } = body as {
    department?: string;
    weekOf?: string;
    availableHours?: number;
    assignedHours?: number;
    utilization?: number;
    underUtilized?: boolean;
  };

  if (!department || !weekOf || availableHours === undefined || assignedHours === undefined || utilization === undefined || underUtilized === undefined) {
    return NextResponse.json(
      { error: "Incomplete capacity payload" },
      { status: 400 }
    );
  }

  const snapshot = {
    id: body.id || `cap-${Date.now()}`,
    department,
    weekOf,
    availableHours,
    assignedHours,
    utilization,
    underUtilized,
  };

  return NextResponse.json({ snapshot, message: "Capacity updated" });
}
