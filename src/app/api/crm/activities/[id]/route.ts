export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getTeamMemberIds, requireCrmAuth } from "@/lib/crm/auth";
import {
  ACTIVITY_RELATED_TYPES,
  ACTIVITY_STATUSES,
  ACTIVITY_TYPES,
  deleteCrmActivity,
  getCrmActivity,
  updateCrmActivity,
} from "@/lib/crm/activities";
import { extractAuthContext } from "@/lib/auth-helper";
import { handleDatabaseError } from "@/lib/api-errors";

async function gateRequest(request: NextRequest, id: string) {
  // tenantSlug arrives via query or body depending on method; the session
  // tenant is authoritative — fall back to it rather than requiring a param.
  const url = new URL(request.url);
  const claimed = url.searchParams.get("tenantSlug");
  const authCtx = extractAuthContext(request);
  const tenantSlug = authCtx.tenantSlug || claimed || "";
  if (!tenantSlug) {
    return { ok: false as const, response: NextResponse.json({ error: "tenantSlug is required" }, { status: 400 }) };
  }
  const gate = await requireCrmAuth(request, tenantSlug);
  if (!gate.ok) return gate;

  const record = await getCrmActivity(id, gate.auth.session.tenantSlug);
  if (!record) {
    return { ok: false as const, response: NextResponse.json({ error: "Activity not found" }, { status: 404 }) };
  }

  // Record scope mirrors the list endpoint: staff touch only their own
  // activities; HODs are limited to their team's. Applies to every method.
  const auth = gate.auth;
  if (auth.scope === "mine") {
    if (record.assignedTo !== auth.employeeId && record.createdBy !== auth.employeeId) {
      return { ok: false as const, response: NextResponse.json({ error: "Activity not found" }, { status: 404 }) };
    }
  } else if (auth.scope === "team" && auth.departmentId) {
    const teamIds = await getTeamMemberIds(auth.session.tenantSlug, auth.departmentId);
    if (!teamIds.includes(auth.employeeId)) teamIds.push(auth.employeeId);
    if (!teamIds.includes(record.assignedTo ?? "") && !teamIds.includes(record.createdBy ?? "")) {
      return { ok: false as const, response: NextResponse.json({ error: "Activity not found" }, { status: 404 }) };
    }
  }
  return { ok: true as const, auth: gate.auth, record };
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await gateRequest(request, params.id);
  if (!gate.ok) return gate.response;
  return NextResponse.json({ activity: gate.record });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await gateRequest(request, params.id);
  if (!gate.ok) return gate.response;

  const body = await request.json().catch(() => ({}));
  const type = body.type !== undefined ? String(body.type).toLowerCase() : undefined;
  const status = body.status !== undefined ? String(body.status).toLowerCase() : undefined;
  const relatedTo = body.relatedTo !== undefined ? String(body.relatedTo).toLowerCase() : undefined;

  if (type !== undefined && !ACTIVITY_TYPES.includes(type as any)) {
    return NextResponse.json({ error: `Invalid type. Allowed: ${ACTIVITY_TYPES.join(", ")}` }, { status: 400 });
  }
  if (status !== undefined && !ACTIVITY_STATUSES.includes(status as any)) {
    return NextResponse.json({ error: `Invalid status. Allowed: ${ACTIVITY_STATUSES.join(", ")}` }, { status: 400 });
  }
  if (relatedTo !== undefined && !ACTIVITY_RELATED_TYPES.includes(relatedTo as any)) {
    return NextResponse.json({ error: `Invalid relatedTo. Allowed: ${ACTIVITY_RELATED_TYPES.join(", ")}` }, { status: 400 });
  }
  if (body.title !== undefined && !String(body.title).trim()) {
    return NextResponse.json({ error: "Activity title is required" }, { status: 400 });
  }

  try {
    const activity = await updateCrmActivity(params.id, gate.auth.session.tenantSlug, {
      type,
      title: body.title !== undefined ? String(body.title).trim() : undefined,
      description: body.description !== undefined ? String(body.description) : undefined,
      relatedTo,
      relatedId: body.relatedId !== undefined ? String(body.relatedId) : undefined,
      relatedName: body.relatedName !== undefined ? String(body.relatedName) : undefined,
      assignedTo: body.assignedTo !== undefined ? String(body.assignedTo) : undefined,
      dueDate: body.dueDate !== undefined ? String(body.dueDate) : undefined,
      status,
    });
    if (!activity) return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    return NextResponse.json({ activity });
  } catch (error) {
    return handleDatabaseError(error, "Update activity");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await gateRequest(request, params.id);
  if (!gate.ok) return gate.response;

  const deleted = await deleteCrmActivity(params.id, gate.auth.session.tenantSlug);
  if (!deleted) return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
