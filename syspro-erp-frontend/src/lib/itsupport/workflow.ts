import type { Ticket } from './types';

export function transitionTicket(ticket: Ticket, toStatus: string, actorId?: string) {
  const now = new Date().toISOString();
  const updated: Ticket = { ...ticket, status: toStatus, updatedAt: now } as Ticket;
  const log = {
    actor: actorId || 'system',
    at: now,
    from: ticket.status,
    to: toStatus,
    note: `Status changed to ${toStatus}`,
  };
  return { ticket: updated, log };
}

export default transitionTicket;
// Ticket Workflow Engine for IT Support
// Handles lifecycle transitions, audit logging, and time tracking
import type { Ticket, TicketStatus, TicketActivityLog } from './types';

export const TICKET_LIFECYCLE: TicketStatus[] = [
  'new',
  'acknowledged',
  'diagnosing',
  'in_progress',
  'awaiting_customer',
  'awaiting_dependency',
  'resolved',
  'closed',
  'reopened',
];

export const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  new: ['acknowledged'],
  acknowledged: ['diagnosing', 'in_progress'],
  diagnosing: ['in_progress', 'awaiting_dependency', 'awaiting_customer'],
  in_progress: ['awaiting_customer', 'awaiting_dependency', 'resolved'],
  awaiting_customer: ['in_progress', 'resolved'],
  awaiting_dependency: ['in_progress', 'resolved'],
  resolved: ['closed', 'reopened'],
  closed: ['reopened'],
  reopened: ['acknowledged', 'diagnosing'],
};

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionTicket(
  ticket: Ticket,
  toStatus: TicketStatus,
  actorId: string
): { ticket: Ticket; log: TicketActivityLog } {
  if (!canTransition(ticket.status, toStatus)) {
    throw new Error(`Invalid transition: ${ticket.status} → ${toStatus}`);
  }
  const now = new Date().toISOString();
  const prevStatus = ticket.status;
  ticket.status = toStatus;
  ticket.updatedAt = now;
  // Set stage timestamps
  switch (toStatus) {
    case 'acknowledged':
      ticket.acknowledgedAt = now;
      break;
    case 'diagnosing':
      ticket.diagnosingAt = now;
      break;
    case 'in_progress':
      ticket.inProgressAt = now;
      break;
    case 'awaiting_customer':
      ticket.awaitingCustomerAt = now;
      break;
    case 'awaiting_dependency':
      ticket.awaitingDependencyAt = now;
      break;
    case 'resolved':
      ticket.resolvedAt = now;
      break;
    case 'closed':
      ticket.closedAt = now;
      break;
    case 'reopened':
      ticket.reopenedAt = now;
      break;
  }
  const log: TicketActivityLog = {
    id: `local-${Math.random().toString(36).slice(2, 10)}`,
    ticketId: ticket.id,
    action: 'transition',
    actorId,
    fromStatus: prevStatus,
    toStatus,
    timestamp: now,
    details: {},
  };
  return { ticket, log };
}
