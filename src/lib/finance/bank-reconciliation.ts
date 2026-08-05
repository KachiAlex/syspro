import { randomUUID } from "crypto";
import { sql as SQL, SqlClient } from "../sql-client";

export interface BankReconciliation {
  id: string;
  tenantSlug: string;
  accountId: string;
  statementDate: string;
  statementBalance: number;
  bookBalance: number;
  adjustedBookBalance: number;
  difference: number;
  status: "draft" | "in_progress" | "reconciled" | "discrepancy";
  reconciledItems: number;
  unreconciledItems: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReconciliationItem {
  id: string;
  reconciliationId: string;
  transactionType: "deposit" | "withdrawal" | "bank_charge" | "interest" | "transfer";
  transactionDate: string;
  description: string;
  amount: number;
  bookEntryId: string | null;
  isReconciled: boolean;
  reconciledAt: string | null;
  createdAt: string;
}

export async function ensureReconciliationTables(sql: SqlClient = SQL) {
  await sql`
    create table if not exists bank_reconciliations (
      id text primary key,
      tenant_slug text not null,
      account_id text not null,
      statement_date date not null,
      statement_balance numeric not null,
      book_balance numeric not null,
      adjusted_book_balance numeric not null default 0,
      difference numeric not null default 0,
      status text not null default 'draft' check (status in ('draft', 'in_progress', 'reconciled', 'discrepancy')),
      reconciled_items integer not null default 0,
      unreconciled_items integer not null default 0,
      notes text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`
    create table if not exists reconciliation_items (
      id text primary key,
      reconciliation_id text not null references bank_reconciliations (id) on delete cascade,
      transaction_type text not null check (transaction_type in ('deposit', 'withdrawal', 'bank_charge', 'interest', 'transfer')),
      transaction_date date not null,
      description text not null,
      amount numeric not null,
      book_entry_id text,
      is_reconciled boolean not null default false,
      reconciled_at timestamptz,
      created_at timestamptz default now()
    )
  `;

  await sql`create index if not exists bank_recon_tenant_idx on bank_reconciliations (tenant_slug)`;
  await sql`create index if not exists recon_items_recon_idx on reconciliation_items (reconciliation_id)`;
}

export async function createReconciliation(data: {
  tenantSlug: string;
  accountId: string;
  statementDate: string;
  statementBalance: number;
  bookBalance: number;
  notes?: string;
}): Promise<BankReconciliation> {
  const sql = SQL;
  await ensureReconciliationTables(sql);

  const id = randomUUID();
  const difference = Number(data.statementBalance) - Number(data.bookBalance);

  const [row] = (await sql`
    insert into bank_reconciliations (
      id, tenant_slug, account_id, statement_date, statement_balance,
      book_balance, adjusted_book_balance, difference, status, notes
    ) values (
      ${id}, ${data.tenantSlug}, ${data.accountId}, ${data.statementDate},
      ${data.statementBalance}, ${data.bookBalance}, ${data.bookBalance},
      ${difference}, 'draft', ${data.notes ?? null}
    )
    returning *
  `) as any[];

  return normalizeReconciliation(row);
}

export async function listReconciliations(tenantSlug: string, limit = 50): Promise<BankReconciliation[]> {
  const sql = SQL;
  await ensureReconciliationTables(sql);

  const rows = (await sql`
    select * from bank_reconciliations
    where tenant_slug = ${tenantSlug}
    order by statement_date desc, created_at desc
    limit ${limit}
  `) as any[];

  return rows.map(normalizeReconciliation);
}

export async function getReconciliation(id: string, tenantSlug: string): Promise<BankReconciliation | null> {
  const sql = SQL;
  await ensureReconciliationTables(sql);

  const [row] = (await sql`
    select * from bank_reconciliations
    where id = ${id} and tenant_slug = ${tenantSlug}
  `) as any[];

  return row ? normalizeReconciliation(row) : null;
}

export async function addReconciliationItem(data: {
  reconciliationId: string;
  transactionType: string;
  transactionDate: string;
  description: string;
  amount: number;
  bookEntryId?: string;
}): Promise<ReconciliationItem> {
  const sql = SQL;
  await ensureReconciliationTables(sql);

  const id = randomUUID();
  const [row] = (await sql`
    insert into reconciliation_items (
      id, reconciliation_id, transaction_type, transaction_date,
      description, amount, book_entry_id, is_reconciled
    ) values (
      ${id}, ${data.reconciliationId}, ${data.transactionType},
      ${data.transactionDate}, ${data.description}, ${data.amount},
      ${data.bookEntryId ?? null}, false
    )
    returning *
  `) as any[];

  return normalizeReconciliationItem(row);
}

export async function toggleItemReconciliation(itemId: string, isReconciled: boolean): Promise<ReconciliationItem | null> {
  const sql = SQL;
  await ensureReconciliationTables(sql);

  const [row] = (await sql`
    update reconciliation_items
    set is_reconciled = ${isReconciled},
        reconciled_at = ${isReconciled ? new Date().toISOString() : null}
    where id = ${itemId}
    returning *
  `) as any[];

  if (!row) return null;

  await updateReconciliationStats(row.reconciliation_id);

  return normalizeReconciliationItem(row);
}

export async function getReconciliationItems(reconciliationId: string): Promise<ReconciliationItem[]> {
  const sql = SQL;
  await ensureReconciliationTables(sql);

  const rows = (await sql`
    select * from reconciliation_items
    where reconciliation_id = ${reconciliationId}
    order by transaction_date, created_at
  `) as any[];

  return rows.map(normalizeReconciliationItem);
}

export async function finalizeReconciliation(
  id: string,
  tenantSlug: string,
  adjustedBookBalance: number,
  notes?: string
): Promise<BankReconciliation | null> {
  const sql = SQL;
  await ensureReconciliationTables(sql);

  const items = await getReconciliationItems(id);
  const reconciledCount = items.filter(i => i.isReconciled).length;
  const unreconciledCount = items.length - reconciledCount;
  const status = unreconciledCount === 0 ? "reconciled" : "discrepancy";

  const [row] = (await sql`
    update bank_reconciliations
    set adjusted_book_balance = ${adjustedBookBalance},
        reconciled_items = ${reconciledCount},
        unreconciled_items = ${unreconciledCount},
        status = ${status},
        notes = coalesce(notes || chr(10), '') || coalesce(${notes ?? null}, ''),
        updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug}
    returning *
  `) as any[];

  return row ? normalizeReconciliation(row) : null;
}

async function updateReconciliationStats(reconciliationId: string) {
  const sql = SQL;
  const items = await getReconciliationItems(reconciliationId);
  const reconciledCount = items.filter(i => i.isReconciled).length;
  const unreconciledCount = items.length - reconciledCount;
  const status = unreconciledCount === 0 && items.length > 0 ? "in_progress" : "draft";

  await sql`
    update bank_reconciliations
    set reconciled_items = ${reconciledCount},
        unreconciled_items = ${unreconciledCount},
        status = ${status},
        updated_at = now()
    where id = ${reconciliationId}
  `;
}

function normalizeReconciliation(row: any): BankReconciliation {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    accountId: row.account_id,
    statementDate: row.statement_date,
    statementBalance: Number(row.statement_balance),
    bookBalance: Number(row.book_balance),
    adjustedBookBalance: Number(row.adjusted_book_balance),
    difference: Number(row.difference),
    status: row.status,
    reconciledItems: row.reconciled_items,
    unreconciledItems: row.unreconciled_items,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeReconciliationItem(row: any): ReconciliationItem {
  return {
    id: row.id,
    reconciliationId: row.reconciliation_id,
    transactionType: row.transaction_type,
    transactionDate: row.transaction_date,
    description: row.description,
    amount: Number(row.amount),
    bookEntryId: row.book_entry_id,
    isReconciled: row.is_reconciled,
    reconciledAt: row.reconciled_at,
    createdAt: row.created_at,
  };
}
