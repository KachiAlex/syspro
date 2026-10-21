import { randomUUID } from "crypto";
import { db, sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { postGLEntry, GLLineInput, ensureGLTables } from "./gl";
import { GL_ACCOUNTS } from "./gl";

// ---------------------------------------------------------------------------
// Ledger integrity tools (ERPNext: Repost Accounting Ledger, Unreconcile-adjacent
// diagnostics, Transaction Deletion Record, GL-vs-Payment-Ledger comparison).
// ---------------------------------------------------------------------------

export function ensureIntegrityTables() {
  return ensureOnce("finance/integrity:ensureTables", async () => {
    const sql = SQL;
    await sql`
      create table if not exists transaction_deletion_records (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        document_type text not null,
        document_id text not null,
        document_data jsonb,
        deleted_by text,
        reason text,
        created_at timestamptz not null default now()
      )`;
    await sql`create index if not exists tdr_idx
      on transaction_deletion_records (tenant_slug, document_type, created_at)`;
  });
}

/** Audit-record a transaction before it is deleted/voided. */
export async function recordTransactionDeletion(input: {
  tenantSlug: string; documentType: string; documentId: string;
  documentData?: unknown; deletedBy?: string; reason?: string;
}) {
  await ensureIntegrityTables();
  await SQL`
    insert into transaction_deletion_records (id, tenant_slug, document_type, document_id, document_data, deleted_by, reason)
    values (${randomUUID()}, ${input.tenantSlug}, ${input.documentType}, ${input.documentId},
            ${input.documentData ? JSON.stringify(input.documentData) : null},
            ${input.deletedBy ?? null}, ${input.reason ?? null})`;
}

export async function listDeletionRecords(tenantSlug: string, documentType?: string) {
  await ensureIntegrityTables();
  return (await SQL`
    select * from transaction_deletion_records
    where tenant_slug = ${tenantSlug}
      ${documentType ? SQL`and document_type = ${documentType}` : SQL``}
    order by created_at desc limit 500
  `) as any[];
}

// ─── Repost Accounting Ledger ───────────────────────────────────────────────

/**
 * ERPNext repost rebuilds GL from source vouchers. Our equivalent: for each
 * selected journal entry, post a REVERSING entry then re-post the same lines
 * (optionally with corrected account codes / dimensions) as a fresh entry.
 * Preview mode returns current lines without writing.
 */
export async function previewRepost(input: { tenantSlug: string; entryIds: string[] }) {
  await ensureGLTables();
  const { rows } = await db.query(
    `select e.id entry_id, e.journal_number, e.posting_date::text, e.reference_type, e.reference_id, e.description,
            l.id line_id, l.account_code, l.account_name, l.debit_amount, l.credit_amount,
            l.party_type, l.party_id, l.branch_id, l.department_id, l.project_id, l.cost_center_id, l.dimensions
     from journal_entries e
     join journal_entry_lines l on l.entry_id = e.id
     where e.tenant_slug = $1 and e.id = any($2) and e.status = 'posted'
     order by e.journal_number, l.line_number`,
    [input.tenantSlug, input.entryIds],
  );
  const byEntry = new Map<string, any>();
  for (const r of rows as any[]) {
    const e = byEntry.get(r.entry_id) ?? {
      entryId: r.entry_id, journalNumber: r.journal_number, postingDate: r.posting_date,
      referenceType: r.reference_type, referenceId: r.reference_id, description: r.description, lines: [] as any[],
    };
    e.lines.push({
      lineId: r.line_id, accountCode: r.account_code, accountName: r.account_name,
      debitAmount: Number(r.debit_amount), creditAmount: Number(r.credit_amount),
      partyType: r.party_type, partyId: r.party_id, branchId: r.branch_id,
      departmentId: r.department_id, projectId: r.project_id, costCenterId: r.cost_center_id,
      dimensions: r.dimensions,
    });
    byEntry.set(r.entry_id, e);
  }
  return [...byEntry.values()];
}

export async function repostJournalEntries(input: {
  tenantSlug: string; entryIds: string[];
  /** Per-line corrections keyed by lineId: replace account/dimension values. */
  corrections?: Record<string, Partial<GLLineInput>>;
  reason?: string;
  userId?: string;
}) {
  const preview = await previewRepost(input);
  if (!preview.length) throw new Error("No posted entries matched");
  const results: Array<{ originalId: string; reversalId: string; repostedId: string }> = [];

  const { reverseGLEntry } = await import("./gl");
  for (const entry of preview) {
    const reversal = await reverseGLEntry(
      entry.entryId,
      `Repost reversal — ${input.reason ?? "correction"}`,
      input.userId,
    );
    const lines: GLLineInput[] = entry.lines.map((l: any) => {
      const fix = input.corrections?.[l.lineId] ?? {};
      return {
        accountCode: fix.accountCode ?? l.accountCode,
        debitAmount: fix.debitAmount ?? l.debitAmount,
        creditAmount: fix.creditAmount ?? l.creditAmount,
        description: fix.description ?? l.description,
        partyType: fix.partyType ?? l.partyType,
        partyId: fix.partyId ?? l.partyId,
        branchId: fix.branchId ?? l.branchId,
        departmentId: fix.departmentId ?? l.departmentId,
        projectId: fix.projectId ?? l.projectId,
        costCenterId: fix.costCenterId ?? l.costCenterId,
        dimensions: fix.dimensions ?? l.dimensions ?? undefined,
      };
    });
    const reposted = await postGLEntry({
      tenantSlug: input.tenantSlug,
      entryDate: entry.postingDate,
      journalType: "SYSTEM",
      referenceType: entry.referenceType ?? "repost",
      referenceId: entry.referenceId,
      description: `${entry.description} (reposted${input.reason ? `: ${input.reason}` : ""})`,
      createdBy: input.userId,
      metadata: { repostOf: entry.entryId, reversalId: reversal.id },
      lines,
    });
    results.push({ originalId: entry.entryId, reversalId: reversal.id, repostedId: reposted.id });
  }
  return results;
}

// ─── GL vs Subledger Comparison ─────────────────────────────────────────────

/**
 * Compares AR/AP control-account balances in the GL against subledger state:
 *   AR expected = Σ invoice balance_due + Σ unallocated customer payments (negative AR)
 *   AP expected = Σ bill balance_due  + Σ unapplied vendor payments (negative AP)
 * Mirrors ERPNext's General and Payment Ledger Comparison.
 */
export async function glVsSubledgerComparison(input: { tenantSlug: string }) {
  await ensureGLTables();
  const t = input.tenantSlug;

  const { rows: gl } = await db.query(
    `select l.account_code, sum(l.debit - l.credit) balance
     from journal_entry_lines l
     join journal_entries e on e.id = l.entry_id
     where e.tenant_slug = $1 and e.status = 'posted'
       and l.account_code in ($2, $3)
     group by l.account_code`,
    [t, GL_ACCOUNTS.ACCOUNTS_RECEIVABLE, GL_ACCOUNTS.ACCOUNTS_PAYABLE],
  );
  const glMap = new Map((gl as any[]).map((r) => [r.account_code, Number(r.balance)]));

  const { rows: ar } = await db.query(
    `select coalesce(sum(balance_due),0) open_invoices
     from finance_invoices where tenant_slug = $1 and status not in ('void','draft')`,
    [t],
  );
  const { rows: unalloc } = await db.query(
    `select coalesce(sum(net_amount - coalesce(applied.total,0)),0) unallocated
     from finance_payments p
     left join (select payment_id, sum(amount) total from payment_applications group by payment_id) applied
       on applied.payment_id = p.id
     where p.tenant_slug = $1`,
    [t],
  );
  const { rows: ap } = await db.query(
    `select coalesce(sum(balance_due),0) open_bills
     from bills where tenant_slug = $1 and status not in ('void','cancelled','draft')`,
    [t],
  );
  const { rows: vap } = await db.query(
    `select coalesce(sum(unapplied_amount),0) unapplied
     from vendor_payments where tenant_slug = $1`,
    [t],
  );

  const arLedger = Number((ar as any[])[0]?.open_invoices ?? 0) - Number((unalloc as any[])[0]?.unallocated ?? 0);
  const apLedger = Number((ap as any[])[0]?.open_bills ?? 0) + Number((vap as any[])[0]?.unapplied ?? 0);

  return {
    receivable: {
      glBalance: glMap.get(GL_ACCOUNTS.ACCOUNTS_RECEIVABLE) ?? 0,
      subledgerBalance: Math.round(arLedger * 100) / 100,
      difference: Math.round(((glMap.get(GL_ACCOUNTS.ACCOUNTS_RECEIVABLE) ?? 0) - arLedger) * 100) / 100,
      components: { openInvoices: Number((ar as any[])[0]?.open_invoices ?? 0), unallocatedPayments: Number((unalloc as any[])[0]?.unallocated ?? 0) },
    },
    payable: {
      // AP is credit-normal in GL: compare negative GL balance to subledger.
      glBalance: -(glMap.get(GL_ACCOUNTS.ACCOUNTS_PAYABLE) ?? 0),
      subledgerBalance: Math.round(apLedger * 100) / 100,
      difference: Math.round((-(glMap.get(GL_ACCOUNTS.ACCOUNTS_PAYABLE) ?? 0) - apLedger) * 100) / 100,
      components: { openBills: Number((ap as any[])[0]?.open_bills ?? 0), unappliedPayments: Number((vap as any[])[0]?.unapplied ?? 0) },
    },
  };
}

// ─── Ledger Merge ────────────────────────────────────────────────────────────

/**
 * Merge account `fromCode` into `toCode` — rewrites every journal_entry_lines
 * account_code reference, merges chart_of_accounts rows, and marks the source
 * account inactive. Mirrors ERPNext's "Merge Account" (rename in CoA tree).
 * Irreversible through the UI — call with confirmed=true.
 */
export async function mergeAccounts(input: {
  tenantSlug: string; fromCode: string; toCode: string;
  userId?: string; confirmed?: boolean;
}) {
  await ensureGLTables();
  if (!input.confirmed) throw new Error("Pass confirmed: true — merge is not easily reversible");
  const t = input.tenantSlug;

  const from = (await db.query<any>(
    `select * from chart_of_accounts where code = $2 and (tenant_slug = $1 or tenant_slug is null)`, [t, input.fromCode],
  )).rows;
  const to = (await db.query<any>(
    `select * from chart_of_accounts where code = $2 and (tenant_slug = $1 or tenant_slug is null)`, [t, input.toCode],
  )).rows;
  if (!from[0]) throw new Error(`Source account ${input.fromCode} not found`);
  if (!to[0]) throw new Error(`Target account ${input.toCode} not found`);
  const fromType = (from[0].account_type ?? from[0].type)?.toUpperCase();
  const toType = (to[0].account_type ?? to[0].type)?.toUpperCase();
  if (fromType && toType && fromType !== toType) {
    throw new Error(`Type mismatch: ${fromType} ≠ ${toType}`);
  }

  const stats: Record<string, number> = {};

  // GL lines (join through entries for tenant scope)
  stats.journalLines = (await db.query(
    `update journal_entry_lines l set account_code = $3, account_name = $4
     from journal_entries e
     where l.entry_id = e.id and e.tenant_slug = $1 and l.account_code = $2`,
    [t, input.fromCode, input.toCode, to[0].name ?? to[0].account_name ?? input.toCode],
  )).rowCount ?? 0;

  // Subledger account references
  const subledgerTargets: Array<{ table: string; col: string }> = [
    { table: "bills", col: "expense_account_code" },
    { table: "finance_invoices", col: "revenue_account_code" },
    { table: "finance_payments", col: "account_code" },
    { table: "bank_statement_lines", col: "bank_account_code" },
    { table: "budgets", col: "account_code" },
    { table: "deferred_items", col: "deferred_account_code" },
    { table: "deferred_items", col: "recognition_account_code" },
  ];
  for (const { table, col } of subledgerTargets) {
    try {
      stats[`${table}.${col}`] = (await db.query(
        `update ${table} set ${col} = $3 where tenant_slug = $1 and ${col} = $2`,
        [t, input.fromCode, input.toCode],
      )).rowCount ?? 0;
    } catch { /* table/column may not exist — skip */ }
  }

  // Retire the source account (tenant-scoped row if present; shared rows get
  // a tenant-specific tombstone update by code only when tenant_slug matches)
  await db.query(
    `update chart_of_accounts set is_active = false,
        name = name || ' (merged → ' || $3 || ')',
        account_name = account_name || ' (merged → ' || $3 || ')'
     where code = $2 and tenant_slug = $1`,
    [t, input.fromCode, input.toCode],
  );

  // Audit trail
  await ensureIntegrityTables();
  await SQL`
    insert into transaction_deletion_records
      (tenant_slug, document_type, document_id, document_data, deleted_by, reason)
    values (${t}, 'account_merge', ${input.fromCode},
            ${JSON.stringify({ mergedInto: input.toCode, stats })}::jsonb,
            ${input.userId ?? null}, ${`Account ${input.fromCode} merged into ${input.toCode}`})
  `;

  return { merged: input.fromCode, into: input.toCode, stats };
}
