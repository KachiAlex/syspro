// Auto-triage: classify and route ticket using rules/ML
export async function autoTriageTicket(ticket: any, engineers: any[] = []) {
  // Example rules-based triage
  // 1. Assign by keywords in title/description/tags
  const text = `${ticket.title} ${ticket.description || ''} ${(ticket.tags || []).join(' ')}`.toLowerCase();
  if (text.includes('fiber') || text.includes('backbone')) {
    ticket.serviceArea = 'Core Network';
    ticket.priority = 'critical';
    // Assign to engineer with fiber skill
    const fiberEng = engineers.find(e => e.skills?.includes('fiber') && e.onDuty);
    if (fiberEng) ticket.assignedEngineerId = fiberEng.id;
  } else if (text.includes('vpn') || text.includes('auth')) {
    ticket.serviceArea = 'Internal IT';
    ticket.priority = 'high';
    const itEng = engineers.find(e => e.skills?.includes('windows') && e.onDuty);
    if (itEng) ticket.assignedEngineerId = itEng.id;
  } else if (text.includes('power')) {
    ticket.serviceArea = 'Customer Sites';
    ticket.priority = 'medium';
    const powerEng = engineers.find(e => e.skills?.includes('power') && e.onDuty);
    if (powerEng) ticket.assignedEngineerId = powerEng.id;
  }
  // 2. Fallback: assign to least loaded on-duty engineer
  if (!ticket.assignedEngineerId && engineers.length > 0) {
    const onDuty = engineers.filter(e => e.onDuty);
    if (onDuty.length > 0) {
      const leastLoaded = onDuty.reduce((min, e) => (e.currentLoad < min.currentLoad ? e : min), onDuty[0]);
      ticket.assignedEngineerId = leastLoaded.id;
    }
  }
  // 3. Add triage log (could be extended for ML)
  ticket.triagedAt = new Date().toISOString();
  return ticket;
}
// Automation & Intelligence Service Stubs
import { sendNotification } from './integrations/notifications';
import { getTenantSupportData } from '@/lib/support-data';

  // Best practice: escalate to next in chain, notify responsible party, log escalation
  const tenantSlug = ticket.tenantSlug || 'default';
  const data = getTenantSupportData(tenantSlug);
  const slaPolicy = data.slaPolicies.find(p => p.id === ticket.slaPolicyId);
  if (!slaPolicy || !slaPolicy.autoEscalate) return ticket;
  const chain = slaPolicy.escalationChain || [];
  let currentLevel = ticket.escalationLevel || 0;
  if (currentLevel < chain.length) {
    const nextRole = chain[currentLevel];
    ticket.escalationLevel = currentLevel + 1;
    await sendNotification({
      to: `${nextRole}@company.com`,
      subject: 'Ticket Auto-Escalated',
      message: `Ticket ${ticket.id} has been auto-escalated to ${nextRole} due to SLA breach.`
    });
    // Optionally log escalation activity here
  }
  return ticket;
}

  const now = Date.now();
  if (new Date(ticket.slaResolutionDue).getTime() < now && !ticket.slaBreached) {
    ticket.slaBreached = true;
    await sendNotification({
      to: 'support@company.com',
      subject: 'SLA Breach',
      message: `Ticket ${ticket.id} has breached its SLA.`
    });
    // Escalate if policy allows
    await autoEscalate(ticket);
    // Optionally log SLA breach activity here
  }
  return ticket;
}

export async function suggestKnowledge(ticket: any) {
  // TODO: Suggest KB articles based on ticket tags/description
  return [
    { id: 'kb-1', title: 'How to resolve network issues' },
    { id: 'kb-2', title: 'Common hardware faults' }
  ];
}


// Root cause clustering: group tickets/incidents by keyword/rule (extensible for ML)
export async function clusterRootCauses(tickets: any[]) {
  // Example rules-based clustering by keywords in title/description/tags
  const clusters: Record<string, { rootCause: string; count: number; sampleIds: string[] }> = {};
  const rules = [
    { key: 'Network', match: (t: any) => /fiber|network|backbone|mpls/i.test(`${t.title} ${t.description} ${(t.tags||[]).join(' ')}`) },
    { key: 'Hardware', match: (t: any) => /hardware|device|router|switch/i.test(`${t.title} ${t.description} ${(t.tags||[]).join(' ')}`) },
    { key: 'Power', match: (t: any) => /power|ups|battery|electric/i.test(`${t.title} ${t.description} ${(t.tags||[]).join(' ')}`) },
    { key: 'Authentication', match: (t: any) => /auth|login|password|sso/i.test(`${t.title} ${t.description} ${(t.tags||[]).join(' ')}`) },
    { key: 'Other', match: (_t: any) => true },
  ];
  for (const ticket of tickets) {
    const rule = rules.find(r => r.match(ticket))!;
    if (!clusters[rule.key]) clusters[rule.key] = { rootCause: rule.key, count: 0, sampleIds: [] };
    clusters[rule.key].count++;
    clusters[rule.key].sampleIds.push(ticket.id || ticket.ticketId || ticket.incidentId);
  }
  return Object.values(clusters);
}
