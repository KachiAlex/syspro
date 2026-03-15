import { NextResponse } from "next/server";
import { getAttendance, handleAttendanceAction, updateAttendanceSignals } from "@/lib/attendance";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "today";
    const tenantSlug = url.searchParams.get("tenantSlug") || undefined;
    const employeeId = url.searchParams.get("employeeId") || undefined;

    const result = await getAttendance({ action, tenantSlug, employeeId, urlSearchParams: url.searchParams });
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    console.error("GET /api/attendance error", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await handleAttendanceAction(body);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("POST /api/attendance error", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const result = await updateAttendanceSignals(body);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("PUT /api/attendance error", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
