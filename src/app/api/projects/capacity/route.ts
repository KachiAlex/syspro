import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import {
  getProjectCapacitySnapshots,
  upsertProjectCapacitySnapshot,
} from "@/lib/projects/db";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const rawSnapshots = await getProjectCapacitySnapshots(context.tenantSlug);
  const capacity = rawSnapshots.map((s: any) => ({
    id: s.id,
    department: s.department,
    availableHours: Number(s.available_hours),
    assignedHours: Number(s.assigned_hours),
    utilization: Number(s.utilization),
    underUtilized: Boolean(s.under_utilized),
    weekOf: s.week_of,
  }));
  return NextResponse.json({ capacity });
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

  const snapshot = await upsertProjectCapacitySnapshot(
    context.tenantSlug,
    {
      department,
      weekOf,
      availableHours: Number(availableHours),
      assignedHours: Number(assignedHours),
      utilization: Number(utilization),
      underUtilized: Boolean(underUtilized),
    },
    context.userId
  );

  return NextResponse.json({ snapshot, message: "Capacity updated" });
}
