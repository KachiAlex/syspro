export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getAttendance, handleAttendanceAction, updateAttendanceSignals } from "@/lib/attendance";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: Request) {
  // requireTenantScope resolves tenantSlug from the query string and verifies
  // the session belongs to it — prevents cross-tenant record listing.
  const scope = await requireModuleAccess(request, "people", "read");
  if (!scope.ok) return scope.response;

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "today";
    const tenantSlug = url.searchParams.get("tenantSlug") || undefined;
    const employeeId = url.searchParams.get("employeeId") || undefined;
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);

    const result = await getAttendance({ action, tenantId: tenantSlug, employeeId, limit });
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    console.error("GET /api/attendance error", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const scope = await requireModuleAccess(request, "people", "write");
  if (!scope.ok) return scope.response;

  try {
    const body = await request.json();
    // Bind the record to the authenticated session tenant — never trust a
    // body-supplied tenant that differs from the verified scope.
    body.tenantId = scope.user.tenantSlug ?? body.tenantSlug ?? body.tenantId;
    const result = await handleAttendanceAction(body);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("POST /api/attendance error", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const scope = await requireModuleAccess(request, "people", "write");
  if (!scope.ok) return scope.response;

  try {
    const body = await request.json();
    body.tenantId = scope.user.tenantSlug ?? body.tenantSlug ?? body.tenantId;
    const result = await updateAttendanceSignals(body);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("PUT /api/attendance error", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
