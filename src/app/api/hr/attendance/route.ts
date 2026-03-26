import { NextRequest, NextResponse } from "next/server";

// In-memory storage for attendance records
const attendanceRecords: Record<string, Array<{ id: string; employeeId: string; employeeName: string; date: string; status: "present" | "absent" | "late" | "leave" }>> = {};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug") || "default";

  const tenantAttendance = attendanceRecords[tenantSlug] || [];
  return NextResponse.json({ attendance: tenantAttendance });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenantSlug = "default", employeeId, employeeName, date, status } = body;

  if (!employeeId || !employeeName || !date || !status) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (!attendanceRecords[tenantSlug]) {
    attendanceRecords[tenantSlug] = [];
  }

  const newRecord = {
    id: `att-${Date.now()}`,
    employeeId,
    employeeName,
    date,
    status,
  };

  attendanceRecords[tenantSlug].push(newRecord);

  return NextResponse.json(
    { attendance: newRecord, message: "Attendance recorded successfully" },
    { status: 201 }
  );
}
