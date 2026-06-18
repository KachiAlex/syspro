import { NextRequest, NextResponse } from "next/server";

import {
  type TicketStatus,
  type SupportTicket,
} from "@/lib/support-data";
import {
  getTicketById,
  updateTicket,
} from "@/lib/support-db";
import { syncCustomerTicket } from '@/lib/itsupport/integrations/crm';
import { validateTenantContext } from "@/lib/tenant-admin/utils";

type RouteContext = {
  params: { ticketId: string };
};

export async function GET(request: NextRequest, context: any) {
  const ctx = validateTenantContext(request, "read");
  const { searchParams } = new URL(request.url);
  const tenantSlug = ctx.tenantSlug;
  const ticket = await getTicketById(tenantSlug, context.params.ticketId);
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  return NextResponse.json({ ticket });
}

export async function PATCH(request: NextRequest, context: any) {
  const ctx = validateTenantContext(request, "write");
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

  const tenantSlug = ctx.tenantSlug;

  const ticket = await updateTicket(tenantSlug, context.params.ticketId, {
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

  // Sync ticket update with CRM (ignore errors, log if needed)
  try {
    await syncCustomerTicket(ticket.id, ticket);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[CRM Sync] Failed to sync ticket update:', err);
  }

  return NextResponse.json({ ticket });
}
