import { describe, it, expect, vi } from 'vitest';
// Mock the DB layer so tests don't depend on the SQL shim
vi.mock('@/lib/finance/db', () => ({
  approveExpense: vi.fn(async (expenseId: string, tenantSlug: string, approval: any) => ({
    id: expenseId,
    tenantSlug,
    approvalStatus: approval.action === 'APPROVED' ? 'APPROVED' : 'PENDING',
  })),
  ensureFinanceTables: vi.fn(async () => {}),
}));

import { approveExpense as serviceApprove } from '@/lib/finance/service';

describe('expense approvals (service wrapper)', () => {
  it('forwards approval to DB and returns updated expense', async () => {
    const res = await serviceApprove('tenant-x', 'exp-123', { approverRole: 'MANAGER', approverId: 'u1', approverName: 'U One', action: 'APPROVED' });
    expect(res).toBeTruthy();
    expect((res as any).id).toBe('exp-123');
    expect((res as any).approvalStatus).toBe('APPROVED');
  });
});
