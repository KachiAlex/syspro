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
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/sql-client', () => {
  const db = { query: vi.fn() } as any;
  const SQL = (..._args: any[]) => Promise.resolve([]);
  return { db, sql: SQL };
});

import { db } from '../lib/sql-client';
import { calculateAttributionForTenant } from '../lib/marketing/service';

beforeEach(() => {
  (db.query as any).mockReset();
});

describe('marketing.service.calculateAttributionForTenant', () => {
  it('attributes first_touch correctly', async () => {
    (db.query as any).mockResolvedValue({ rows: [{ id: 'o1', campaign_id: 'c1', value: 100, closed_at: '2025-01-01T10:00:00Z' }] });
    const res = await calculateAttributionForTenant('t1', 'first_touch');
    expect(res.total).toBe(100);
    expect(res.totalsByCampaign['c1']).toBe(100);
  });

  it('splits linear across opportunities', async () => {
    (db.query as any).mockResolvedValue({ rows: [
      { id: 'o1', campaign_id: 'c1', value: 100, closed_at: '2025-01-01T10:00:00Z' },
      { id: 'o2', campaign_id: 'c2', value: 0, closed_at: '2025-01-02T10:00:00Z' },
    ] });
    const res = await calculateAttributionForTenant('t1', 'linear');
    expect(res.total).toBe(100);
    const c1 = res.totalsByCampaign['c1'] ?? 0;
    const c2 = res.totalsByCampaign['c2'] ?? 0;
    expect(Math.round(c1 + c2)).toBe(100);
  });
});
