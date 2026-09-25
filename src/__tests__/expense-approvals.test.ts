import { describe, it, expect, vi } from 'vitest';

// Mock the DB layer so tests don't depend on a live Postgres connection.
// finance/service.ts executes raw SQL via sql-client's db.query.
vi.mock('@/lib/sql-client', () => ({
  db: {
    query: vi.fn(async (text: string, params: any[]) => ({
      rows: [{ id: params[2], tenant_slug: params[3], approval_status: params[0] }],
    })),
    join: vi.fn(),
    mapRows: vi.fn((r: any) => r),
  },
  sql: vi.fn(),
}));

vi.mock('@/lib/finance/db', () => ({
  approveExpense: vi.fn(),
  ensureFinanceTables: vi.fn(async () => {}),
}));

import { approveExpense as serviceApprove } from '@/lib/finance/service';

describe('expense approvals (service wrapper)', () => {
  it('forwards approval to DB and returns updated expense', async () => {
    const res = await serviceApprove('tenant-x', 'exp-123', { approverRole: 'MANAGER', approverId: 'u1', approverName: 'U One', action: 'APPROVED' });
    expect(res).toBeTruthy();
    expect((res as any).id).toBe('exp-123');
    expect((res as any).approval_status).toBe('APPROVED');
  });
});
