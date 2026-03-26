// SLA Service for IT Support
// Handles SLA timers, breach detection, escalation logic
import type { Ticket, SLA } from './types';

export function getSLAForCategory(slas: SLA[], category: string): SLA | undefined {
  return slas.find((s) => s.category === category);
}

export function computeSLADueTimes(
  now: Date,
  sla: SLA
): { responseDue: Date; resolutionDue: Date } {
  const responseDue = new Date(now.getTime() + sla.responseMinutes * 60000);
  const resolutionDue = new Date(now.getTime() + sla.resolutionMinutes * 60000);
  return { responseDue, resolutionDue };
}

export function checkSLABreach(ticket: Ticket, now: Date): { responseBreached: boolean; resolutionBreached: boolean } {
  const responseBreached = ticket.slaResponseDue && now > new Date(ticket.slaResponseDue);
  const resolutionBreached = ticket.slaResolutionDue && now > new Date(ticket.slaResolutionDue);
  return { responseBreached, resolutionBreached };
}

export function shouldEscalate(ticket: Ticket, now: Date): boolean {
  // Example: escalate if resolution breached and not already escalated
  return (
    ticket.slaResolutionDue &&
    now > new Date(ticket.slaResolutionDue) &&
    !ticket.escalationLevel
  );
}
