// Assignment Engine for IT Support
// Assigns tickets to best-fit engineer based on skills, location, workload, on-duty status, and performance
import type { Ticket, EngineerProfile } from './types';

export function findBestEngineer(
  ticket: Ticket,
  engineers: EngineerProfile[]
): { primary?: EngineerProfile; backup?: EngineerProfile } {
  // Filter on-duty engineers in the same branch
  const candidates = engineers.filter(
    (e) => e.onDuty && e.branchId === ticket.branchId
  );
  // Score by skills match, workload, and performance
  const scored = candidates.map((e) => {
    let score = 0;
    // Skill match
    if (ticket.tags && e.skills.some((s) => ticket.tags!.includes(s))) score += 3;
    // Lower workload is better
    score += 2 * (10 - Math.min(e.workload, 10));
    // Higher performance is better
    score += e.performanceScore;
    return { engineer: e, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return {
    primary: scored[0]?.engineer,
    backup: scored[1]?.engineer,
  };
}
