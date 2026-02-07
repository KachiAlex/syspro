import { NextRequest, NextResponse } from "next/server";

import {
  getTicketById,
  updateTicket,
  type TicketStatus,
  type SupportTicket,
} from "@/lib/support-data";

type RouteContext = {
  params: { ticketId: string };
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug") || "default";
  const ticket = getTicketById(tenantSlug, context.params.ticketId);
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  return NextResponse.json({ ticket });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const body = (await request.json()) as {
    tenantSlug?: string;
    status?: TicketStatus;
    assignedEngineerId?: string | null;
    backupEngineerId?: string | null;
    priority?: SupportTicket["priority"];
    impactLevel?: SupportTicket["impactLevel"];
    tags?: string[];
    updatedBy?: string;
  };

  const { searchParams } = new URL(request.url);
  const tenantSlug = body.tenantSlug || searchParams.get("tenantSlug") || "default";

  const ticket = updateTicket(tenantSlug, context.params.ticketId, {
    status: body.status,
    assignedEngineerId: body.assignedEngineerId,
    backupEngineerId: body.backupEngineerId,
    priority: body.priority,
    impactLevel: body.impactLevel,
    tags: body.tags,
    updatedBy: body.updatedBy,
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  return NextResponse.json({ ticket });
}
