// Auto-triage and simple automation helpers
import { sendNotification } from './integrations/notifications';
import { getTenantSupportData } from '@/lib/support-data';

export async function autoTriageTicket(ticket: any, engineers: any[] = []) {
  // Example rules-based triage
  const text = `${ticket.title} ${ticket.description || ''} ${(ticket.tags || []).join(' ')}`.toLowerCase();
  if (text.includes('fiber') || text.includes('backbone')) {
    ticket.serviceArea = 'Core Network';
    ticket.priority = 'critical';
    const fiberEng = engineers.find((e) => e.skills?.includes('fiber') && e.onDuty);
    if (fiberEng) ticket.assignedEngineerId = fiberEng.id;
  } else if (text.includes('vpn') || text.includes('auth')) {
    ticket.serviceArea = 'Internal IT';
    ticket.priority = 'high';
    const itEng = engineers.find((e) => e.skills?.includes('windows') && e.onDuty);
    if (itEng) ticket.assignedEngineerId = itEng.id;
  } else if (text.includes('power')) {
    ticket.serviceArea = 'Customer Sites';
    ticket.priority = 'medium';
    const powerEng = engineers.find((e) => e.skills?.includes('power') && e.onDuty);
    if (powerEng) ticket.assignedEngineerId = powerEng.id;
  }

  if (!ticket.assignedEngineerId && engineers.length > 0) {
    const onDuty = engineers.filter((e) => e.onDuty);
    if (onDuty.length > 0) {
      const leastLoaded = onDuty.reduce((min: any, e: any) => (e.currentLoad < min.currentLoad ? e : min), onDuty[0]);
      ticket.assignedEngineerId = leastLoaded.id;
    }
  }

  ticket.triagedAt = new Date().toISOString();
  return ticket;
}

export async function autoEscalate(ticket: any) {
  const tenantSlug = ticket.tenantSlug || 'default';
  const data = getTenantSupportData(tenantSlug);
  const slaPolicy = data.slaPolicies.find((p) => p.id === ticket.slaPolicyId);
  if (!slaPolicy || !slaPolicy.autoEscalate) return ticket;

  const chain = slaPolicy.escalationChain || [];
  let currentLevel = ticket.escalationLevel || 0;
  if (currentLevel < chain.length) {
    const nextRole = chain[currentLevel];
    ticket.escalationLevel = currentLevel + 1;
    try {
      await sendNotification({
        to: `${nextRole}@company.com`,
        subject: 'Ticket Auto-Escalated',
        message: `Ticket ${ticket.id} has been auto-escalated to ${nextRole} due to SLA breach.`,
      });
    } catch (e) {
      // ignore notification failures in dev
    }
  }
  return ticket;
}

export async function detectSlaBreach(ticket: any) {
  const now = Date.now();
  const resDue = ticket.resolutionDueAt || ticket.resolutionDue || ticket.slaResolutionDue;
  if (!resDue) return ticket;
  if (new Date(resDue).getTime() < now && !ticket.slaBreached) {
    ticket.slaBreached = true;
    try {
      await sendNotification({
        to: 'support@company.com',
        subject: 'SLA Breach',
        message: `Ticket ${ticket.id} has breached its SLA.`,
      });
    } catch (e) {
      // ignore
    }
    await autoEscalate(ticket);
  }
  return ticket;
}

export async function suggestKnowledge(ticket: any) {
  // TODO: Suggest KB articles based on ticket tags/description
  return [
    { id: 'kb-1', title: 'How to resolve network issues' },
    { id: 'kb-2', title: 'Common hardware faults' },
  ];
}

export async function clusterRootCauses(tickets: any[]) {
  const clusters: Record<string, { rootCause: string; count: number; sampleIds: string[] }> = {};
  const rules = [
    {
      key: 'Network',
      match: (t: any) => /fiber|network|backbone|mpls/i.test(`${t.title} ${t.description} ${(t.tags || []).join(' ')}`),
    },
    {
      key: 'Hardware',
      match: (t: any) => /hardware|device|router|switch/i.test(`${t.title} ${t.description} ${(t.tags || []).join(' ')}`),
    },
    {
      key: 'Power',
      match: (t: any) => /power|ups|battery|electric/i.test(`${t.title} ${t.description} ${(t.tags || []).join(' ')}`),
    },
    {
      key: 'Authentication',
      match: (t: any) => /auth|login|password|sso/i.test(`${t.title} ${t.description} ${(t.tags || []).join(' ')}`),
    },
    { key: 'Other', match: (_t: any) => true },
  ];
  for (const ticket of tickets) {
    const rule = rules.find((r) => r.match(ticket))!;
    if (!clusters[rule.key]) clusters[rule.key] = { rootCause: rule.key, count: 0, sampleIds: [] };
    clusters[rule.key].count++;
    clusters[rule.key].sampleIds.push(ticket.id || ticket.ticketNumber || ticket.incidentId);
  }
  return Object.values(clusters);
}
