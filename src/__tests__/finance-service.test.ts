import { describe, it, expect } from 'vitest';
import { createJournalEntry, validateJournalLines, postJournalEntry } from '@/lib/finance/service';
import type { JournalEntry } from '@/lib/finance/types';

describe('finance service', () => {
  it('validates balanced journal lines', () => {
    const lines = [
      { tenant_id: 't1', account_id: 'a1', amount: 100, side: 'debit' },
      { tenant_id: 't1', account_id: 'a2', amount: 100, side: 'credit' },
    ];
    expect(validateJournalLines(lines)).toBe(true);
  });

  it('throws on unbalanced lines', () => {
    const lines = [
      { tenant_id: 't1', account_id: 'a1', amount: 100, side: 'debit' },
      { tenant_id: 't1', account_id: 'a2', amount: 50, side: 'credit' },
    ];
    expect(() => validateJournalLines(lines)).toThrow(/unbalanced/);
  });

  it('creates and posts a journal entry', () => {
    const entry: JournalEntry = {
      tenant_id: 't1',
      description: 'Test entry',
      lines: [
        { tenant_id: 't1', account_id: 'a1', amount: 25, side: 'debit' },
        { tenant_id: 't1', account_id: 'a2', amount: 25, side: 'credit' },
      ],
    };

    const created = createJournalEntry(entry);
    expect(created.id).toBeDefined();
    expect(created.lines).toHaveLength(2);

    const posted = postJournalEntry(created);
    expect(posted.status).toEqual('posted');
    expect(posted.posted_at).toBeDefined();
  });
});
