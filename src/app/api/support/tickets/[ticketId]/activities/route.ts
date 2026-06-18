import { NextRequest, NextResponse } from "next/server";

import { addTicketActivity, getTicketById, listTicketActivities } from "@/lib/support-db";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

type RouteContext = {
  params: { ticketId: string };
};

export async function GET(request: NextRequest, context: any) {
  const ctx = validateTenantContext(request, "read");
  const { searchParams } = new URL(request.url);
  const tenantSlug = ctx.tenantSlug;
  const activities = await listTicketActivities(tenantSlug, context.params.ticketId);
  return NextResponse.json({ activities });
}

export async function POST(request: NextRequest, context: any) {
  const ctx = validateTenantContext(request, "write");
  const body = (await request.json()) as {
    tenantSlug?: string;
    activityType?: string;
    actorId?: string;
    details?: Record<string, unknown>;
  };

  if (!body.activityType) {
    return NextResponse.json({ error: "activityType is required" }, { status: 400 });
  }

  const tenantSlug = ctx.tenantSlug;
  const ticket = await getTicketById(tenantSlug, context.params.ticketId);
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const activity = await addTicketActivity(tenantSlug, ticket.id, {
    activityType: body.activityType,
    actorId: body.actorId,
    details: body.details,
  });

  return NextResponse.json({ activity }, { status: 201 });
}
