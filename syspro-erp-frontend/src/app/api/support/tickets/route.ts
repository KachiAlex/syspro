import { NextRequest, NextResponse } from "next/server";

import {
  createTicket,
  listTickets,
  type CreateTicketInput,
  type TicketFilters,
  type TicketStatus,
  type TicketType,
  type SupportTicket,
} from "@/lib/support-data";

function buildFilters(searchParams: URLSearchParams): TicketFilters {
  const filters: TicketFilters = {};
  const status = searchParams.get("status") as TicketStatus | null;
  const priority = searchParams.get("priority") as SupportTicket["priority"] | null;
  const ticketType = searchParams.get("ticketType") as TicketType | null;
  const assignedEngineerId = searchParams.get("assignedEngineerId");
  const region = searchParams.get("region");
  const serviceArea = searchParams.get("serviceArea");

  if (status) filters.status = status;
  if (priority) filters.priority = priority;
  if (ticketType) filters.ticketType = ticketType;
  if (assignedEngineerId) filters.assignedEngineerId = assignedEngineerId;
  if (region) filters.region = region;
  if (serviceArea) filters.serviceArea = serviceArea;

  return filters;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug") || "default";
  const tickets = listTickets(tenantSlug, buildFilters(searchParams));

  const payload = {
    tickets,
    totals: {
      count: tickets.length,
      critical: tickets.filter((ticket) => ticket.priority === "critical").length,
      breached: tickets.filter((ticket) => ticket.resolutionBreachedAt).length,
      awaitingCustomer: tickets.filter((ticket) => ticket.status === "awaiting_customer").length,
    },
  };

  return NextResponse.json(payload);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<CreateTicketInput>;
  const tenantSlug = body.tenantSlug || "default";

  const requiredFields: Array<keyof CreateTicketInput> = [
    "title",
    "ticketType",
    "source",
    "impactLevel",
    "priority",
  ];
  const missingField = requiredFields.find((field) => !body[field]);
  if (missingField) {
    return NextResponse.json({ error: `Missing field: ${missingField}` }, { status: 400 });
  }

  const ticket = createTicket({
    tenantSlug,
    title: body.title!,
    description: body.description,
    ticketType: body.ticketType!,
    source: body.source!,
    impactLevel: body.impactLevel!,
    priority: body.priority!,
    departmentId: body.departmentId,
    serviceArea: body.serviceArea,
    region: body.region,
    branchId: body.branchId,
    customerId: body.customerId,
    projectId: body.projectId,
    tags: body.tags,
    createdBy: body.createdBy,
  });

  return NextResponse.json({ ticket, message: "Ticket created" }, { status: 201 });
}
