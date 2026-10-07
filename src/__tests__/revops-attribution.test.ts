/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
import { calculateAttributionSummary } from '../lib/revops/attribution';

function makeEvent(id: string, campaignId: string | null, amount: number, t: string) {
  return { id, campaignId, amount, occurredAt: t } as any;
}

describe('marketing service - attribution helper', () => {
  const events = [
    makeEvent('e1', 'c1', 100, '2025-01-01T10:00:00Z'),
    makeEvent('e2', 'c2', 0, '2025-01-02T10:00:00Z'),
    makeEvent('e3', 'c1', 0, '2025-01-03T10:00:00Z'),
  ];

  it('first_touch attributes to first campaign', () => {
    const res = calculateAttributionSummary(events, 'first_touch');
    expect(res.total).toBe(100);
    expect(res.totalsByCampaign['c1']).toBe(100);
  });

  it('linear splits total across events', () => {
    const res = calculateAttributionSummary(events, 'linear');
    expect(res.total).toBe(100);
    const c1 = res.totalsByCampaign['c1'] ?? 0;
    const c2 = res.totalsByCampaign['c2'] ?? 0;
    expect(Math.round(c1 + c2)).toBe(100);
  });
});
