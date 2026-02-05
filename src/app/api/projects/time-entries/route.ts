import { NextRequest, NextResponse } from "next/server";

// In-memory storage for time entries
const timeEntries: Record<string, Array<{ id: string; projectId: string; employeeName: string; hours: number; date: string; billable: boolean }>> = {};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug") || "default";

  const tenantTimeEntries = timeEntries[tenantSlug] || [];
  return NextResponse.json({ timeEntries: tenantTimeEntries });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenantSlug = "default", projectId, employeeName, hours, date, billable } = body;

  if (!projectId || !employeeName || hours === undefined || !date) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (!timeEntries[tenantSlug]) {
    timeEntries[tenantSlug] = [];
  }

  const newTimeEntry = {
    id: `time-${Date.now()}`,
    projectId,
    employeeName,
    hours: parseFloat(hours),
    date,
    billable: billable || false,
  };

  timeEntries[tenantSlug].push(newTimeEntry);

  return NextResponse.json(
    { timeEntry: newTimeEntry, message: "Time entry logged successfully" },
    { status: 201 }
  );
}
