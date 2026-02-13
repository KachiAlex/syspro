import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the sql-client to control DB responses
vi.mock('@/lib/sql-client', () => {
  const db = { query: vi.fn() } as any;
  const SQL = (..._args: any[]) => Promise.resolve([]);
  return { db, sql: SQL };
});

import { db } from '@/lib/sql-client';
import { calculateAttributionForTenant } from './service';

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
