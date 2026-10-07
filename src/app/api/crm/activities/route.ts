export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { listActivities } from "@/lib/crm/db";
import { getTeamMemberIds, requireCrmAuth } from "@/lib/crm/auth";
import {
  ACTIVITY_RELATED_TYPES,
  ACTIVITY_STATUSES,
  ACTIVITY_TYPES,
  insertCrmActivity,
  listCrmActivities,
} from "@/lib/crm/activities";
import { handleDatabaseError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  const gate = await requireCrmAuth(request, tenantSlug);
  if (!gate.ok) return gate.response;

  const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 100;
  const entityType = url.searchParams.get("entityType") || undefined;
  const entityId = url.searchParams.get("entityId") || undefined;

  try {
    // Audit-trail mode: entity history reads the crm_activity_log stream.
    if (entityType && entityId) {
      const activities = await listActivities({ tenantSlug, limit, entityType, entityId });
      return NextResponse.json({ activities });
    }

    // Task feed: ownerIds restrict staff to their own activities; HOD sees
    // the team, admins see all.
    let ownerIds: string[] | undefined;
    if (gate.auth.scope === "mine") {
      ownerIds = [gate.auth.employeeId];
    } else if (gate.auth.scope === "team" && gate.auth.departmentId) {
      ownerIds = await getTeamMemberIds(tenantSlug, gate.auth.departmentId);
      if (!ownerIds.includes(gate.auth.employeeId)) ownerIds.push(gate.auth.employeeId);
    }

    const type = url.searchParams.get("type") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const relatedTo = url.searchParams.get("relatedTo") || undefined;
    const relatedId = url.searchParams.get("relatedId") || undefined;
    const search = url.searchParams.get("search") || undefined;

    const activities = await listCrmActivities({
      tenantSlug,
      type: type && ACTIVITY_TYPES.includes(type as any) ? type : undefined,
      status: status && ACTIVITY_STATUSES.includes(status as any) ? status : undefined,
      relatedTo: relatedTo && ACTIVITY_RELATED_TYPES.includes(relatedTo as any) ? relatedTo : undefined,
      relatedId,
      search,
      ownerIds,
      limit,
    });
    return NextResponse.json({ activities });
  } catch (error) {
    return handleDatabaseError(error, "List activities");
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const tenantSlug = body.tenantSlug;
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  const gate = await requireCrmAuth(request, tenantSlug);
  if (!gate.ok) return gate.response;

  const type = String(body.type || "").toLowerCase();
  const title = String(body.title || "").trim();
  const status = body.status ? String(body.status).toLowerCase() : "pending";
  const relatedTo = body.relatedTo ? String(body.relatedTo).toLowerCase() : undefined;

  if (!title) {
    return NextResponse.json({ error: "Activity title is required" }, { status: 400 });
  }
  if (!ACTIVITY_TYPES.includes(type as any)) {
    return NextResponse.json({ error: `Invalid type. Allowed: ${ACTIVITY_TYPES.join(", ")}` }, { status: 400 });
  }
  if (!ACTIVITY_STATUSES.includes(status as any)) {
    return NextResponse.json({ error: `Invalid status. Allowed: ${ACTIVITY_STATUSES.join(", ")}` }, { status: 400 });
  }
  if (relatedTo && !ACTIVITY_RELATED_TYPES.includes(relatedTo as any)) {
    return NextResponse.json({ error: `Invalid relatedTo. Allowed: ${ACTIVITY_RELATED_TYPES.join(", ")}` }, { status: 400 });
  }

  try {
    const activity = await insertCrmActivity({
      tenantSlug,
      type,
      title,
      description: body.description ? String(body.description) : undefined,
      relatedTo,
      relatedId: body.relatedId ? String(body.relatedId) : undefined,
      relatedName: body.relatedName ? String(body.relatedName) : undefined,
      assignedTo: body.assignedTo ? String(body.assignedTo) : gate.auth.employeeId,
      dueDate: body.dueDate ? String(body.dueDate) : undefined,
      status,
      createdBy: gate.auth.employeeId,
    });
    return NextResponse.json({ activity }, { status: 201 });
  } catch (error) {
    return handleDatabaseError(error, "Create activity");
  }
}
