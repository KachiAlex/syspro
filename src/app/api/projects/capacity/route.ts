import { NextRequest, NextResponse } from "next/server";

import { listCapacity, upsertCapacitySnapshot } from "@/lib/projects-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug") || "default";

  const capacity = listCapacity(tenantSlug);
  return NextResponse.json({ capacity });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const {
    tenantSlug = "default",
    id,
    department,
    weekOf,
    availableHours,
    assignedHours,
    utilization,
    underUtilized,
  } = body as {
    tenantSlug?: string;
    id?: string;
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

  const snapshot = upsertCapacitySnapshot(tenantSlug, {
    id,
    department,
    weekOf,
    availableHours,
    assignedHours,
    utilization,
    underUtilized,
  });

  return NextResponse.json({ snapshot, message: "Capacity updated" });
}
