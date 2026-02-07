import { NextRequest, NextResponse } from "next/server";

import { addTicketActivity, getTicketById, listTicketActivities } from "@/lib/support-data";

type RouteContext = {
  params: { ticketId: string };
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug") || "default";
  const activities = listTicketActivities(tenantSlug, context.params.ticketId);
  return NextResponse.json({ activities });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const body = (await request.json()) as {
    tenantSlug?: string;
    activityType?: string;
    actorId?: string;
    details?: Record<string, unknown>;
  };

  if (!body.activityType) {
    return NextResponse.json({ error: "activityType is required" }, { status: 400 });
  }

  const tenantSlug = body.tenantSlug || "default";
  const ticket = getTicketById(tenantSlug, context.params.ticketId);
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const activity = addTicketActivity(tenantSlug, ticket.id, {
    activityType: body.activityType,
    actorId: body.actorId,
    details: body.details,
  });

  return NextResponse.json({ activity }, { status: 201 });
}
