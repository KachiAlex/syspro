import { randomUUID } from "crypto";

import { db, sql as SQL } from "../sql-client";
import type { SqlClient } from "../sql-client";
import { uploadReceipt } from "./uploads";
import type {
  FinanceAccount,
  FinanceAccountCreateInput,
  FinanceAccountUpdateInput,
  FinanceInvoice,
  FinanceInvoiceCreateInput,
  FinanceInvoiceLine,
  FinanceInvoiceStatus,
  FinanceInvoiceUpdateInput,
} from "@/lib/finance/types";

/* using imported SQL */

export type FinanceAccountRecord = {
  id: string;
  tenant_slug: string;
  region_id: string | null;
  branch_id: string | null;
  name: string;
  type: "bank" | "cash";
  currency: string;
  balance: number;
  change_value: number | null;
  change_period: string | null;
  trend: "up" | "down";
  bank_name: string | null;
  bank_code: string | null;
  account_number: string | null;
  account_name: string | null;
  swift_code: string | null;
  created_at: string;
  updated_at: string;
};

export type FinanceInvoiceRecord = {
  id: string;
  tenant_slug: string;
  region_id: string | null;
  branch_id: string | null;
  customer_name: string;
  customer_code: string | null;
  customer_id: string | null;
  customer_email: string | null;
  invoice_number: string;
  purchase_order: string | null;
  issued_date: string;
  due_date: string;
  currency: string;
  amount: number;
  balance_due: number;
  status: FinanceInvoiceStatus;
  payment_terms: string | null;
  notes: string | null;
  tags: string[] | null;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

export type FinanceInvoiceLineRecord = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  account_code: string | null;
  tax_rate: number | null;
  created_at: string;
  updated_at: string;
};

export type FinanceScheduleRecord = {
  id: string;
  tenant_slug: string;
  region_id: string | null;
  branch_id: string | null;
  entity_name: string;
  amount: number;
  currency: string;
  due_date: string;
  status: "current" | "due_soon" | "overdue";
  document_type: "receivable" | "payable";
  created_at: string;
  updated_at: string;
};

export type FinanceExpenseCategoryRecord = {
  id: string;
  tenant_slug: string;
  region_id: string | null;
  branch_id: string | null;
  label: string;
  amount: number;
  delta_percent: number;
  direction: "up" | "down";
  created_at: string;
  updated_at: string;
};

export type FinanceTrendPointRecord = {
  id: string;
  tenant_slug: string;
  region_id: string | null;
  branch_id: string | null;
  timeframe: string;
  label: string;
  revenue: number;
  expenses: number;
  created_at: string;
};

export function ensureFinanceTables(...args: Parameters<typeof ensureFinanceTablesRun>) {
  return ensureOnce("finance/db:ensureFinanceTables", () => ensureFinanceTablesRun(...args));
}

async function ensureFinanceTablesRun(sql: SqlClient = SQL) {
  await sql`
    create table if not exists finance_accounts (
      id text primary key,
      tenant_slug text not null,
      region_id text,
      branch_id text,
      name text not null,
      type text not null check (type in ('bank', 'cash')),
      currency text not null default '₦',
      balance numeric not null default 0,
      change_value numeric,
      change_period text,
      trend text not null default 'up' check (trend in ('up', 'down')),
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`alter table finance_accounts add column if not exists bank_name text`;
  await sql`alter table finance_accounts add column if not exists bank_code text`;
  await sql`alter table finance_accounts add column if not exists account_number text`;
  await sql`alter table finance_accounts add column if not exists account_name text`;
  await sql`alter table finance_accounts add column if not exists swift_code text`;

  await sql`
    create table if not exists finance_schedules (
      id text primary key,
      tenant_slug text not null,
      region_id text,
      branch_id text,
      entity_name text not null,
      amount numeric not null,
      currency text not null default '₦',
      due_date date not null,
      status text not null default 'current' check (status in ('current', 'due_soon', 'overdue')),
      document_type text not null check (document_type in ('receivable', 'payable')),
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`
    create table if not exists finance_expense_categories (
      id text primary key,
      tenant_slug text not null,
      region_id text,
      branch_id text,
      label text not null,
      amount numeric not null,
      delta_percent numeric not null,
      direction text not null check (direction in ('up', 'down')),
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`
    create table if not exists finance_trend_points (
      id text primary key,
      tenant_slug text not null,
      region_id text,
      branch_id text,
      timeframe text not null,
      label text not null,
      revenue numeric not null,
      expenses numeric not null,
      created_at timestamptz default now()
    )
  `;

  await sql`
    create table if not exists finance_invoices (
      id text primary key,
      tenant_slug text not null,
      region_id text,
      branch_id text,
      customer_name text not null,
      customer_code text,
      invoice_number text not null,
      purchase_order text,
      issued_date date not null,
      due_date date not null,
      currency text not null default '₦',
      amount numeric not null,
      balance_due numeric not null,
      status text not null default 'draft' check (status in ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void')),
      payment_terms text,
      notes text,
      tags text[]
      check (tags is null or array_length(tags, 1) <= 32),
      metadata jsonb,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`alter table if exists finance_invoices add column if not exists customer_id text`;
  await sql`alter table if exists finance_invoices add column if not exists customer_email text`;
  await sql`
    create table if not exists finance_invoice_lines (
      id text primary key,
      invoice_id text not null references finance_invoices (id) on delete cascade,
      description text not null,
      quantity numeric not null,
      unit_price numeric not null,
      amount numeric not null,
      account_code text,
      tax_rate numeric,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`
    create table if not exists finance_payments (
      id text primary key,
      tenant_slug text not null,
      customer_id text,
      invoice_id text,
      reference text not null,
      gross_amount numeric not null,
      fees numeric not null default 0,
      net_amount numeric not null,
      method text not null check (method in ('bank_transfer', 'check', 'cash', 'pos', 'mobile_money', 'wire', 'paystack', 'flutterwave', 'stripe')),
      gateway text check (gateway in ('paystack', 'flutterwave', 'stripe', 'manual')),
      gateway_reference text,
      payment_date date not null,
      settlement_date date,
      confirmation_details text,
      status text not null default 'pending' check (status in ('pending', 'successful', 'failed', 'reversed')),
      linked_invoices text[],
      metadata jsonb,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`
    create table if not exists finance_subscriptions (
      id text primary key,
      tenant_slug text not null,
      plan text not null,
      status text not null default 'active' check (status in ('trial', 'active', 'suspended', 'cancelled')),
      seats integer not null default 1,
      price numeric not null default 0,
      features text[] default array[]::text[],
      next_billing_date date,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`
    create table if not exists payment_applications (
      id uuid primary key default gen_random_uuid(),
      tenant_slug text not null,
      payment_id text not null,
      invoice_id text not null,
      amount numeric(18,2) not null,
      created_at timestamptz not null default now()
    )
  `;

  await sql`alter table if exists finance_invoices add column if not exists journal_entry_id uuid`;
  await sql`alter table if exists finance_invoices add column if not exists reversed_journal_entry_id uuid`;
  await sql`alter table if exists finance_payments add column if not exists journal_entry_id uuid`;
  await sql`alter table if exists finance_payments add column if not exists reversed_journal_entry_id uuid`;

  await sql`create index if not exists finance_accounts_tenant_idx on finance_accounts (tenant_slug)`;
  await sql`create index if not exists finance_schedules_tenant_idx on finance_schedules (tenant_slug, document_type)`;
  await sql`create index if not exists finance_expense_categories_tenant_idx on finance_expense_categories (tenant_slug)`;
  await sql`create index if not exists finance_trend_points_tenant_idx on finance_trend_points (tenant_slug, timeframe)`;
  await sql`create index if not exists finance_invoices_tenant_idx on finance_invoices (tenant_slug, status)`;
  await sql`create index if not exists finance_invoice_lines_invoice_idx on finance_invoice_lines (invoice_id)`;
  await sql`create index if not exists finance_payments_tenant_idx on finance_payments (tenant_slug, status)`;
  await sql`create index if not exists finance_payments_invoice_idx on finance_payments (invoice_id)`;
  await sql`create index if not exists finance_subscriptions_tenant_idx on finance_subscriptions (tenant_slug, status)`;
  await sql`create index if not exists payment_applications_payment_idx on payment_applications (payment_id)`;
  await sql`create index if not exists payment_applications_invoice_idx on payment_applications (invoice_id)`;
}

function normalizeFinanceAccountRow(row: FinanceAccountRecord): FinanceAccount {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    regionId: row.region_id,
    branchId: row.branch_id,
    name: row.name,
    type: row.type,
    currency: row.currency,
    balance: Number(row.balance ?? 0),
    changeValue: row.change_value !== null ? Number(row.change_value) : null,
    changePeriod: row.change_period,
    trend: row.trend === "down" ? "down" : "up",
    bankName: row.bank_name ?? null,
    bankCode: row.bank_code ?? null,
    accountNumber: row.account_number ?? null,
    accountName: row.account_name ?? null,
    swiftCode: row.swift_code ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listFinanceAccounts(filters: {
  tenantSlug: string;
  regionId?: string | null;
  branchId?: string | null;
  limit?: number;
  offset?: number;
}): Promise<FinanceAccount[]> {
  const sql = SQL;
  await ensureFinanceTables(sql);
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
  const offset = Math.max(filters.offset ?? 0, 0);
  
  let rows: FinanceAccountRecord[];
  if (filters.regionId && filters.branchId) {
    rows = (await sql`
      select *
      from finance_accounts
      where tenant_slug = ${filters.tenantSlug}
        and (region_id is null or region_id = ${filters.regionId})
        and (branch_id is null or branch_id = ${filters.branchId})
      order by balance desc
      limit ${limit}
      offset ${offset}
    `) as FinanceAccountRecord[];
  } else if (filters.regionId) {
    rows = (await sql`
      select *
      from finance_accounts
      where tenant_slug = ${filters.tenantSlug}
        and (region_id is null or region_id = ${filters.regionId})
      order by balance desc
      limit ${limit}
      offset ${offset}
    `) as FinanceAccountRecord[];
  } else if (filters.branchId) {
    rows = (await sql`
      select *
      from finance_accounts
      where tenant_slug = ${filters.tenantSlug}
        and (branch_id is null or branch_id = ${filters.branchId})
      order by balance desc
      limit ${limit}
      offset ${offset}
    `) as FinanceAccountRecord[];
  } else {
    rows = (await sql`
      select *
      from finance_accounts
      where tenant_slug = ${filters.tenantSlug}
      order by balance desc
      limit ${limit}
      offset ${offset}
    `) as FinanceAccountRecord[];
  }
  return rows.map(normalizeFinanceAccountRow);
}

export async function insertFinanceAccount(payload: FinanceAccountCreateInput): Promise<FinanceAccount> {
  const sql = SQL;
  await ensureFinanceTables(sql);
  const id = randomUUID();
  const [inserted] = (await sql`
    insert into finance_accounts (
      id,
      tenant_slug,
      region_id,
      branch_id,
      name,
      type,
      currency,
      balance,
      change_value,
      change_period,
      trend,
      bank_name,
      bank_code,
      account_number,
      account_name,
      swift_code
    ) values (
      ${id},
      ${payload.tenantSlug},
      ${payload.regionId ?? null},
      ${payload.branchId ?? null},
      ${payload.name},
      ${payload.type},
      ${payload.currency ?? "₦"},
      ${payload.balance},
      ${payload.changeValue ?? null},
      ${payload.changePeriod ?? null},
      ${payload.trend ?? "up"},
      ${payload.bankName ?? null},
      ${payload.bankCode ?? null},
      ${payload.accountNumber ?? null},
      ${payload.accountName ?? null},
      ${payload.swiftCode ?? null}
    )
    returning *
  `) as FinanceAccountRecord[];
  return normalizeFinanceAccountRow(inserted);
}

export async function updateFinanceAccount(
  id: string,
  updates: FinanceAccountUpdateInput
): Promise<FinanceAccount | null> {
  const sql = SQL;
  await ensureFinanceTables(sql);

  if (
    updates.name === undefined &&
    updates.type === undefined &&
    updates.currency === undefined &&
    updates.balance === undefined &&
    updates.regionId === undefined &&
    updates.branchId === undefined &&
    updates.changeValue === undefined &&
    updates.changePeriod === undefined &&
    updates.trend === undefined &&
    updates.bankName === undefined &&
    updates.bankCode === undefined &&
    updates.accountNumber === undefined &&
    updates.accountName === undefined &&
    updates.swiftCode === undefined
  ) {
    const existing = (await sql`select * from finance_accounts where id = ${id} limit 1`) as FinanceAccountRecord[];
    return existing.length ? normalizeFinanceAccountRow(existing[0]) : null;
  }

  const [updated] = (await sql`
    update finance_accounts
    set
      name = coalesce(${updates.name ?? null}, name),
      type = coalesce(${updates.type ?? null}, type),
      currency = coalesce(${updates.currency ?? null}, currency),
      balance = coalesce(${updates.balance ?? null}, balance),
      region_id = coalesce(${updates.regionId ?? null}, region_id),
      branch_id = coalesce(${updates.branchId ?? null}, branch_id),
      change_value = coalesce(${updates.changeValue ?? null}, change_value),
      change_period = coalesce(${updates.changePeriod ?? null}, change_period),
      trend = coalesce(${updates.trend ?? null}, trend),
      bank_name = coalesce(${updates.bankName ?? null}, bank_name),
      bank_code = coalesce(${updates.bankCode ?? null}, bank_code),
      account_number = coalesce(${updates.accountNumber ?? null}, account_number),
      account_name = coalesce(${updates.accountName ?? null}, account_name),
      swift_code = coalesce(${updates.swiftCode ?? null}, swift_code),
      updated_at = now()
    where id = ${id}
    returning *
  `) as FinanceAccountRecord[];

  if (!updated) {
    return null;
  }

  return normalizeFinanceAccountRow(updated);
}

function normalizeFinanceInvoiceLineRow(row: FinanceInvoiceLineRecord): FinanceInvoiceLine {
  return {
    id: row.id,
    description: row.description,
    quantity: Number(row.quantity ?? 0),
    unitPrice: Number(row.unit_price ?? 0),
    amount: Number(row.amount ?? 0),
    accountCode: row.account_code ?? undefined,
    taxRate: row.tax_rate !== null && row.tax_rate !== undefined ? Number(row.tax_rate) : null,
  };
}

function normalizeFinanceInvoiceRow(row: FinanceInvoiceRecord, lines: FinanceInvoiceLineRecord[]): FinanceInvoice {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    regionId: row.region_id,
    branchId: row.branch_id,
    customerName: row.customer_name,
    customerCode: row.customer_code,
    customerId: row.customer_id ?? undefined,
    customerEmail: row.customer_email ?? undefined,
    invoiceNumber: row.invoice_number,
    purchaseOrder: row.purchase_order,
    issuedDate: row.issued_date,
    dueDate: row.due_date,
    currency: row.currency,
    amount: Number(row.amount ?? 0),
    balanceDue: Number(row.balance_due ?? 0),
    status: row.status,
    paymentTerms: row.payment_terms,
    notes: row.notes,
    tags: Array.isArray(row.tags) ? row.tags : undefined,
    lineItems: lines.map(normalizeFinanceInvoiceLineRow),
    metadata: row.metadata as Record<string, unknown> | null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type InvoiceFilters = {
  tenantSlug: string;
  status?: FinanceInvoiceStatus;
  regionId?: string | null;
  branchId?: string | null;
  limit?: number;
  offset?: number;
};

export async function listFinanceInvoices(filters: InvoiceFilters): Promise<FinanceInvoice[]> {
  const sql = SQL;
  await ensureFinanceTables(sql);
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
  const offset = Math.max(filters.offset ?? 0, 0);
  
  let rows: FinanceInvoiceRecord[];
  if (filters.status && filters.regionId && filters.branchId) {
    rows = (await sql`
      select *
      from finance_invoices
      where tenant_slug = ${filters.tenantSlug}
        and status = ${filters.status}
        and (region_id is null or region_id = ${filters.regionId})
        and (branch_id is null or branch_id = ${filters.branchId})
      order by issued_date desc, created_at desc
      limit ${limit}
      offset ${offset}
    `) as FinanceInvoiceRecord[];
  } else if (filters.status && filters.regionId) {
    rows = (await sql`
      select *
      from finance_invoices
      where tenant_slug = ${filters.tenantSlug}
        and status = ${filters.status}
        and (region_id is null or region_id = ${filters.regionId})
      order by issued_date desc, created_at desc
      limit ${limit}
      offset ${offset}
    `) as FinanceInvoiceRecord[];
  } else if (filters.status && filters.branchId) {
    rows = (await sql`
      select *
      from finance_invoices
      where tenant_slug = ${filters.tenantSlug}
        and status = ${filters.status}
        and (branch_id is null or branch_id = ${filters.branchId})
      order by issued_date desc, created_at desc
      limit ${limit}
      offset ${offset}
    `) as FinanceInvoiceRecord[];
  } else if (filters.status) {
    rows = (await sql`
      select *
      from finance_invoices
      where tenant_slug = ${filters.tenantSlug}
        and status = ${filters.status}
      order by issued_date desc, created_at desc
      limit ${limit}
      offset ${offset}
    `) as FinanceInvoiceRecord[];
  } else if (filters.regionId && filters.branchId) {
    rows = (await sql`
      select *
      from finance_invoices
      where tenant_slug = ${filters.tenantSlug}
        and (region_id is null or region_id = ${filters.regionId})
        and (branch_id is null or branch_id = ${filters.branchId})
      order by issued_date desc, created_at desc
      limit ${limit}
      offset ${offset}
    `) as FinanceInvoiceRecord[];
  } else if (filters.regionId) {
    rows = (await sql`
      select *
      from finance_invoices
      where tenant_slug = ${filters.tenantSlug}
        and (region_id is null or region_id = ${filters.regionId})
      order by issued_date desc, created_at desc
      limit ${limit}
      offset ${offset}
    `) as FinanceInvoiceRecord[];
  } else if (filters.branchId) {
    rows = (await sql`
      select *
      from finance_invoices
      where tenant_slug = ${filters.tenantSlug}
        and (branch_id is null or branch_id = ${filters.branchId})
      order by issued_date desc, created_at desc
      limit ${limit}
      offset ${offset}
    `) as FinanceInvoiceRecord[];
  } else {
    rows = (await sql`
      select *
      from finance_invoices
      where tenant_slug = ${filters.tenantSlug}
      order by issued_date desc, created_at desc
      limit ${limit}
      offset ${offset}
    `) as FinanceInvoiceRecord[];
  }

  if (!rows.length) {
    return [];
  }

  const lineRows = (await sql`
    select *
    from finance_invoice_lines
    where invoice_id = any(${rows.map((row) => row.id)})
  `) as FinanceInvoiceLineRecord[];

  const grouped = lineRows.reduce<Record<string, FinanceInvoiceLineRecord[]>>((acc, line) => {
    if (!acc[line.invoice_id]) {
      acc[line.invoice_id] = [];
    }
    acc[line.invoice_id].push(line);
    return acc;
  }, {});

  return rows.map((row) => normalizeFinanceInvoiceRow(row, grouped[row.id] ?? []));
}

/**
 * Post the invoice to the GL: Dr Accounts Receivable (gross, party=customer),
 * Cr revenue per line (net), Cr VAT output for line tax.
 */
async function postInvoiceJournalEntry(
  invoiceRow: FinanceInvoiceRecord & { journal_entry_id?: string | null },
  lineRows: FinanceInvoiceLineRecord[]
): Promise<string | null> {
  const { postGLEntry, GL_ACCOUNTS } = await import("./gl");

  const gross = Number(invoiceRow.amount);
  const creditLines: Array<{
    accountCode: string;
    debitAmount: number;
    creditAmount: number;
    description: string;
  }> = [];

  let totalTax = 0;
  for (const line of lineRows) {
    const net = Number(line.amount);
    const tax = net * (Number(line.tax_rate ?? 0) / 100);
    totalTax += tax;
    creditLines.push({
      accountCode: line.account_code || GL_ACCOUNTS.SALES_REVENUE,
      debitAmount: 0,
      creditAmount: net,
      description: line.description,
    });
  }
  if (totalTax > 0.005) {
    creditLines.push({
      accountCode: GL_ACCOUNTS.VAT_OUTPUT,
      debitAmount: 0,
      creditAmount: totalTax,
      description: "VAT output on invoice",
    });
  }

  const creditsTotal = creditLines.reduce((s, l) => s + l.creditAmount, 0);
  const residual = gross - creditsTotal;
  if (Math.abs(residual) > 0.005) {
    creditLines.push({
      accountCode: GL_ACCOUNTS.SALES_REVENUE,
      debitAmount: residual < 0 ? Math.abs(residual) : 0,
      creditAmount: residual > 0 ? residual : 0,
      description: "Invoice total adjustment",
    });
  }

  const entry = await postGLEntry({
    tenantSlug: invoiceRow.tenant_slug,
    entryDate: invoiceRow.issued_date,
    journalType: "SYSTEM",
    referenceType: "invoice",
    referenceId: invoiceRow.id,
    branchId: invoiceRow.branch_id ?? undefined,
    description: `Invoice ${invoiceRow.invoice_number} - ${invoiceRow.customer_name}`,
    status: "POSTED",
    metadata: {
      invoiceId: invoiceRow.id,
      invoiceNumber: invoiceRow.invoice_number,
      customerName: invoiceRow.customer_name,
    },
    lines: [
      {
        accountCode: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE,
        debitAmount: gross,
        creditAmount: 0,
        description: `Receivable - ${invoiceRow.customer_name}`,
        partyType: "customer",
        partyId: invoiceRow.customer_code ?? invoiceRow.customer_name,
      },
      ...creditLines,
    ],
  });

  // Statutory ledger: output VAT feeds the VAT return.
  if (totalTax > 0.005) {
    try {
      const { recordInvoiceVat } = await import("./localization");
      const netBase = lineRows.reduce((s, l) => s + Number(l.amount), 0);
      await recordInvoiceVat({
        tenantSlug: invoiceRow.tenant_slug,
        invoiceId: invoiceRow.id,
        invoiceNumber: invoiceRow.invoice_number,
        customerName: invoiceRow.customer_name,
        date: invoiceRow.issued_date,
        baseAmount: netBase,
        taxAmount: totalTax,
      });
    } catch (taxErr) {
      console.error("Failed to record invoice VAT transaction:", taxErr);
    }
  }

  return entry.id;
}

export async function insertFinanceInvoice(payload: FinanceInvoiceCreateInput): Promise<FinanceInvoice> {
  const sql = SQL;
  await ensureFinanceTables(sql);
  const invoiceId = randomUUID();

  // Insert invoice
  const [invoiceRow] = (await sql`
    insert into finance_invoices (
      id,
      tenant_slug,
      region_id,
      branch_id,
      customer_name,
      customer_code,
      customer_id,
      customer_email,
      invoice_number,
      purchase_order,
      issued_date,
      due_date,
      currency,
      amount,
      balance_due,
      status,
      payment_terms,
      notes,
      tags,
      metadata
    ) values (
      ${invoiceId},
      ${payload.tenantSlug},
      ${payload.regionId ?? null},
      ${payload.branchId ?? null},
      ${payload.customerName},
      ${payload.customerCode ?? null},
      ${payload.customerId ?? null},
      ${payload.customerEmail ?? null},
      ${payload.invoiceNumber},
      ${payload.purchaseOrder ?? null},
      ${payload.issuedDate},
      ${payload.dueDate},
      ${payload.currency ?? "₦"},
      ${payload.amount},
      ${payload.balanceDue ?? payload.amount},
      ${payload.status ?? "draft"},
      ${payload.paymentTerms ?? null},
      ${payload.notes ?? null},
      ${Array.isArray(payload.tags) ? payload.tags : null},
      ${payload.metadata ?? null}
    )
    returning *
  `) as FinanceInvoiceRecord[];

  // Insert line items
  const lineRows = await Promise.all(payload.lineItems.map(async (line) => {
    const rows = (await sql`
      insert into finance_invoice_lines (
        id,
        invoice_id,
        description,
        quantity,
        unit_price,
        amount,
        account_code,
        tax_rate
      ) values (
        ${randomUUID()},
        ${invoiceId},
        ${line.description},
        ${line.quantity},
        ${line.unitPrice},
        ${line.amount ?? line.quantity * line.unitPrice},
        ${line.accountCode ?? null},
        ${line.taxRate ?? null}
      )
      returning *
    `) as FinanceInvoiceLineRecord[];
    return rows[0];
  })) as FinanceInvoiceLineRecord[];

  // Post to the GL when the invoice is issued in a non-draft state
  const status = invoiceRow.status ?? "draft";
  if (status !== "draft" && status !== "void") {
    if (invoiceRow.customer_code) {
      const { assertCreditAvailable } = await import("./credit-control");
      await assertCreditAvailable(
        payload.tenantSlug, invoiceRow.customer_code, Number(invoiceRow.amount)
      );
    }
    try {
      const journalEntryId = await postInvoiceJournalEntry(invoiceRow, lineRows);
      if (journalEntryId) {
        await sql`update finance_invoices set journal_entry_id = ${journalEntryId} where id = ${invoiceId}`;
      }
      const { buildInvoiceSchedule } = await import("./credit-control");
      await buildInvoiceSchedule({
        tenantSlug: payload.tenantSlug,
        invoiceId,
        issueDate: invoiceRow.issued_date,
        amount: Number(invoiceRow.amount),
        paymentTermId: (invoiceRow as any).payment_term_id,
        dueDate: invoiceRow.due_date,
      });
    } catch (err) {
      console.error("Failed to post invoice journal entry:", err);
    }
  }

  return normalizeFinanceInvoiceRow(invoiceRow, lineRows);
}

export async function updateFinanceInvoice(
  id: string,
  updates: FinanceInvoiceUpdateInput,
  tenantSlug?: string
): Promise<FinanceInvoice | null> {
  const sql = SQL;
  await ensureFinanceTables(sql);

  const [originalInvoice] = (await sql`
    select * from finance_invoices where id = ${id}
  `) as FinanceInvoiceRecord[];

  if (!originalInvoice) {
    return null;
  }

  const wasPosted = Boolean((originalInvoice as any).journal_entry_id);
  const touchesFinancials =
    updates.lineItems !== undefined || updates.amount !== undefined || updates.balanceDue !== undefined;
  if (wasPosted && touchesFinancials) {
    throw new Error("Issued invoices cannot be edited; void the invoice and issue a new one");
  }

  const paymentsApplied = Number(originalInvoice.amount) - Number(originalInvoice.balance_due);

  let [invoiceRow] = (await sql`
    update finance_invoices
    set
      customer_name = coalesce(${updates.customerName ?? null}, customer_name),
      customer_code = coalesce(${updates.customerCode ?? null}, customer_code),
      invoice_number = coalesce(${updates.invoiceNumber ?? null}, invoice_number),
      purchase_order = coalesce(${updates.purchaseOrder ?? null}, purchase_order),
      issued_date = coalesce(${updates.issuedDate ?? null}, issued_date),
      due_date = coalesce(${updates.dueDate ?? null}, due_date),
      currency = coalesce(${updates.currency ?? null}, currency),
      amount = coalesce(${updates.amount ?? null}, amount),
      balance_due = coalesce(${updates.balanceDue ?? null}, balance_due),
      status = coalesce(${updates.status ?? null}, status),
      payment_terms = coalesce(${updates.paymentTerms ?? null}, payment_terms),
      notes = coalesce(${updates.notes ?? null}, notes),
      tags = coalesce(${updates.tags ?? null}, tags),
      metadata = coalesce(${updates.metadata ?? null}, metadata),
      region_id = coalesce(${updates.regionId ?? null}, region_id),
      branch_id = coalesce(${updates.branchId ?? null}, branch_id),
      updated_at = now()
    where id = ${id}
    ${tenantSlug ? sql`and tenant_slug = ${tenantSlug}` : sql``}
    returning *
  `) as FinanceInvoiceRecord[];

  if (!invoiceRow) {
    return null;
  }

  let lineRows: FinanceInvoiceLineRecord[] | null = null;
  if (updates.lineItems && updates.lineItems.length) {
    await sql`delete from finance_invoice_lines where invoice_id = ${id}`;
    lineRows = await Promise.all(
      updates.lineItems.map(async (line) => {
        const rows = (await sql`
          insert into finance_invoice_lines (
            id,
            invoice_id,
            description,
            quantity,
            unit_price,
            amount,
            account_code,
            tax_rate
          ) values (
            ${randomUUID()},
            ${id},
            ${line.description},
            ${line.quantity},
            ${line.unitPrice},
            ${line.amount ?? line.quantity * line.unitPrice},
            ${line.accountCode ?? null},
            ${line.taxRate ?? null}
          )
          returning *
        `) as FinanceInvoiceLineRecord[];
        return rows[0];
      })
    );

    const newAmount = lineRows.reduce((sum, line) => sum + Number(line.amount), 0);
    const newBalanceDue = Math.max(0, newAmount - paymentsApplied);

    const [recalculatedRow] = (await sql`
      update finance_invoices
      set amount = ${newAmount},
          balance_due = ${newBalanceDue},
          updated_at = now()
      where id = ${id}
      returning *
    `) as FinanceInvoiceRecord[];

    if (recalculatedRow) {
      invoiceRow = recalculatedRow;
    }
  }

  if (!lineRows) {
    lineRows = (await sql`
      select * from finance_invoice_lines where invoice_id = ${id}
    `) as FinanceInvoiceLineRecord[];
  }

  // Voiding an issued invoice reverses its journal entry
  if (
    updates.status === "void" &&
    (originalInvoice as any).journal_entry_id &&
    !(originalInvoice as any).reversed_journal_entry_id
  ) {
    try {
      const { reverseGLEntry } = await import("./gl");
      const reversal = await reverseGLEntry(
        (originalInvoice as any).journal_entry_id,
        `Void invoice ${originalInvoice.invoice_number}`
      );
      await sql`update finance_invoices set reversed_journal_entry_id = ${reversal.id}, balance_due = 0 where id = ${id}`;
      invoiceRow.balance_due = 0;
    } catch (err) {
      console.error("Failed to reverse invoice journal entry:", err);
    }
  }

  // Draft -> issued transition posts the invoice to the GL
  if (
    originalInvoice.status === "draft" &&
    updates.status &&
    updates.status !== "draft" &&
    updates.status !== "void" &&
    !(originalInvoice as any).journal_entry_id
  ) {
    if (invoiceRow.customer_code) {
      const { assertCreditAvailable } = await import("./credit-control");
      await assertCreditAvailable(
        invoiceRow.tenant_slug, invoiceRow.customer_code, Number(invoiceRow.amount)
      );
    }
    try {
      const journalEntryId = await postInvoiceJournalEntry(invoiceRow, lineRows);
      if (journalEntryId) {
        await sql`update finance_invoices set journal_entry_id = ${journalEntryId} where id = ${id}`;
      }
      const { buildInvoiceSchedule } = await import("./credit-control");
      await buildInvoiceSchedule({
        tenantSlug: invoiceRow.tenant_slug,
        invoiceId: id,
        issueDate: invoiceRow.issued_date,
        amount: Number(invoiceRow.amount),
        paymentTermId: (invoiceRow as any).payment_term_id,
        dueDate: invoiceRow.due_date,
      });
    } catch (err) {
      console.error("Failed to post invoice journal entry:", err);
    }
  }

  return normalizeFinanceInvoiceRow(invoiceRow, lineRows);
}

export async function deleteFinanceInvoice(id: string, tenantSlug?: string): Promise<boolean> {
  const sql = SQL;
  await ensureFinanceTables(sql);

  const [existing] = tenantSlug
    ? ((await sql`select status, journal_entry_id from finance_invoices where id = ${id} and tenant_slug = ${tenantSlug}`) as any[])
    : ((await sql`select status, journal_entry_id from finance_invoices where id = ${id}`) as any[]);

  if (!existing) {
    return false;
  }
  if (existing.status !== "draft" || existing.journal_entry_id) {
    throw new Error("Only draft invoices can be deleted; void the invoice to reverse it");
  }

  const result = tenantSlug
    ? await db.query<{ count: number }>(`delete from finance_invoices where id = $1 and tenant_slug = $2`, [id, tenantSlug])
    : await db.query<{ count: number }>(`delete from finance_invoices where id = $1`, [id]);
  return result.count > 0;
}

// AR Payment Receipt - receive payment against one or more invoices
export async function receiveInvoicePayment(data: {
  tenantSlug: string;
  invoiceId: string;
  amount: number;
  method: string;
  reference?: string;
  paymentDate: string;
  gateway?: string;
  gatewayReference?: string;
  confirmationDetails?: string;
  allocations?: Array<{ invoiceId: string; amount: number; settledAmount?: number }>;
  transactionCurrency?: string;
  exchangeRate?: number;
  metadata?: Record<string, unknown>;
}): Promise<{ payment: FinancePayment; invoice: FinanceInvoice }> {
  const sql = SQL;
  await ensureFinanceTables(sql);

  const allocations =
    data.allocations && data.allocations.length
      ? data.allocations
      : [{ invoiceId: data.invoiceId, amount: data.amount }];

  // Base AR amount extinguished per allocation (defaults to the received
  // base amount; differs only when settling foreign-currency invoices).
  const settledAllocations = allocations.map((a) => ({
    ...a,
    settledAmount: a.settledAmount ?? a.amount,
  }));
  const settledTotal = settledAllocations.reduce((s, a) => s + a.settledAmount, 0);
  const fxDiff = data.amount - settledTotal; // >0 gain, <0 loss

  const allocatedTotal = allocations.reduce((s, a) => s + a.amount, 0);
  if (Math.abs(allocatedTotal - data.amount) > 0.01) {
    throw new Error(
      `Allocation total (${allocatedTotal}) does not match payment amount (${data.amount})`
    );
  }

  const invoiceRows: FinanceInvoiceRecord[] = [];
  for (const alloc of settledAllocations) {
    const [invoiceRow] = (await sql`
      select * from finance_invoices where id = ${alloc.invoiceId} and tenant_slug = ${data.tenantSlug}
    `) as FinanceInvoiceRecord[];

    if (!invoiceRow) {
      throw new Error(`Invoice ${alloc.invoiceId} not found`);
    }
    if (invoiceRow.status === "void" || invoiceRow.status === "paid") {
      throw new Error(`Cannot receive payment for invoice with status: ${invoiceRow.status}`);
    }

    const newBalanceDue = Number(invoiceRow.balance_due) - alloc.settledAmount;
    const newStatus = newBalanceDue <= 0.01 ? "paid" : "partially_paid";

    const [updatedInvoice] = (await sql`
      update finance_invoices
      set balance_due = ${Math.max(0, newBalanceDue)},
          status = ${newStatus},
          updated_at = now()
      where id = ${alloc.invoiceId} and tenant_slug = ${data.tenantSlug}
      returning *
    `) as FinanceInvoiceRecord[];

    invoiceRows.push(updatedInvoice);
  }

  const primaryInvoice = invoiceRows[0];
  const paymentId = `PAY-${randomUUID().slice(0, 8)}`;
  const paymentRef = data.reference || `RCT-${Date.now()}`;
  const netAmount = data.amount;

  const [paymentRow] = (await sql`
    insert into finance_payments (
      id, tenant_slug, invoice_id, reference,
      gross_amount, fees, net_amount, method,
      gateway, gateway_reference, payment_date,
      confirmation_details, status, linked_invoices, metadata
    ) values (
      ${paymentId}, ${data.tenantSlug}, ${data.invoiceId}, ${paymentRef},
      ${data.amount}, 0, ${netAmount}, ${data.method},
      ${data.gateway ?? "manual"}, ${data.gatewayReference ?? null}, ${data.paymentDate},
      ${data.confirmationDetails ?? null}, 'successful',
      ${allocations.map((a) => a.invoiceId)},
      ${data.metadata ? JSON.stringify(data.metadata) : null}
    )
    returning *
  `) as FinancePaymentRecord[];

  // Record the payment subledger allocations (base AR amount extinguished)
  for (const alloc of settledAllocations) {
    await sql`
      insert into payment_applications (id, tenant_slug, payment_id, invoice_id, amount, created_at)
      values (${randomUUID()}, ${data.tenantSlug}, ${paymentId}, ${alloc.invoiceId}, ${alloc.settledAmount}, now())
    `;
    try {
      const { markSchedulePaid } = await import("./credit-control");
      await markSchedulePaid(data.tenantSlug, alloc.invoiceId, alloc.settledAmount);
    } catch (err) {
      console.error("Failed to update invoice payment schedule:", err);
    }
  }

  const lineRows = (await sql`
    select * from finance_invoice_lines where invoice_id = ${data.invoiceId}
  `) as FinanceInvoiceLineRecord[];

  const payment = normalizePaymentRecord(paymentRow);
  const invoice = normalizeFinanceInvoiceRow(primaryInvoice, lineRows);

  try {
    const { postGLEntry, GL_ACCOUNTS } = await import("./gl");
    const cashAccount =
      data.method === "cash" ? GL_ACCOUNTS.CASH : GL_ACCOUNTS.BANK;
    const entry = await postGLEntry({
      tenantSlug: data.tenantSlug,
      entryDate: data.paymentDate,
      journalType: "SYSTEM",
      referenceType: "payment",
      referenceId: paymentId,
      branchId: primaryInvoice.branch_id ?? undefined,
      description: `AR Payment Receipt - ${paymentRef} - Invoice ${primaryInvoice.invoice_number}`,
      status: "POSTED",
      lines: [
        {
          accountCode: cashAccount,
          debitAmount: data.amount,
          creditAmount: 0,
          description: `Payment received - ${paymentRef}`,
        },
        ...settledAllocations.map((alloc, i) => ({
          accountCode: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE,
          debitAmount: 0,
          creditAmount: alloc.settledAmount,
          description: `AR applied to invoice ${invoiceRows[i].invoice_number}`,
          partyType: "customer" as const,
          partyId: invoiceRows[i].customer_code ?? invoiceRows[i].customer_name,
        })),
        // Realized exchange gain/loss when the base value received differs
        // from the base AR extinguished (foreign-currency settlements).
        ...(Math.abs(fxDiff) > 0.01
          ? fxDiff > 0
            ? [{
                accountCode: GL_ACCOUNTS.EXCHANGE_GAIN_LOSS,
                debitAmount: 0,
                creditAmount: fxDiff,
                description: `Realized exchange gain - ${paymentRef}`,
              }]
            : [{
                accountCode: GL_ACCOUNTS.EXCHANGE_GAIN_LOSS,
                debitAmount: -fxDiff,
                creditAmount: 0,
                description: `Realized exchange loss - ${paymentRef}`,
              }]
          : []),
      ],
      metadata: {
        paymentId,
        invoiceId: data.invoiceId,
        invoiceNumber: primaryInvoice.invoice_number,
        allocations: settledAllocations,
        amount: data.amount,
        method: data.method,
        ...(data.transactionCurrency
          ? { transactionCurrency: data.transactionCurrency, exchangeRate: data.exchangeRate }
          : {}),
      },
    });
    if (data.transactionCurrency || data.exchangeRate != null) {
      await sql`
        update finance_payments set transaction_currency = ${data.transactionCurrency ?? null},
          exchange_rate = ${data.exchangeRate ?? null} where id = ${paymentId}
      `;
    }
    await sql`update finance_payments set journal_entry_id = ${entry.id} where id = ${paymentId}`;
  } catch (err) {
    console.error("Failed to create journal entry for AR payment:", err);
  }

  try {
    const { emitEvent } = await import("@/lib/notify");
    void emitEvent({
      tenantSlug: data.tenantSlug,
      eventType: "payment.received",
      sourceModule: "finance",
      sourceRecordId: paymentId,
      payload: {
        amount: data.amount,
        method: data.method,
        reference: paymentRef,
        invoiceNumber: primaryInvoice.invoice_number,
        customerName: primaryInvoice.customer_name,
        customerId: primaryInvoice.customer_id,
        customerCode: primaryInvoice.customer_code,
        invoiceId: primaryInvoice.id,
        partyEmail: primaryInvoice.customer_email,
      },
    });
  } catch (err) {
    console.error("Failed to emit payment.received:", err);
  }

  return { payment, invoice };
}

// Get payments for a specific invoice
export async function getInvoicePayments(invoiceId: string, tenantSlug: string): Promise<FinancePayment[]> {
  const sql = SQL;
  await ensureFinanceTables(sql);

  const rows = (await sql`
    select * from finance_payments
    where invoice_id = ${invoiceId} and tenant_slug = ${tenantSlug}
    order by payment_date desc, created_at desc
  `) as FinancePaymentRecord[];

  return rows.map(normalizePaymentRecord);
}

// Payment Management Database Functions

export type FinancePaymentRecord = {
  id: string;
  tenant_slug: string;
  customer_id: string | null;
  invoice_id: string | null;
  reference: string;
  gross_amount: number;
  fees: number;
  net_amount: number;
  method: string;
  gateway: string | null;
  gateway_reference: string | null;
  payment_date: string;
  settlement_date: string | null;
  confirmation_details: string;
  status: string;
  linked_invoices: string[] | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type FinancePayment = {
  id: string;
  tenantSlug: string;
  customerId: string | null;
  invoiceId: string | null;
  reference: string;
  grossAmount: number;
  fees: number;
  netAmount: number;
  method: string;
  gateway: string | null;
  gatewayReference: string | null;
  paymentDate: string;
  settlementDate: string | null;
  confirmationDetails: string;
  status: string;
  linkedInvoices: string[];
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

function normalizePaymentRecord(row: FinancePaymentRecord): FinancePayment {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    customerId: row.customer_id,
    invoiceId: row.invoice_id,
    reference: row.reference,
    grossAmount: Number(row.gross_amount),
    fees: Number(row.fees),
    netAmount: Number(row.net_amount),
    method: row.method,
    gateway: row.gateway,
    gatewayReference: row.gateway_reference,
    paymentDate: row.payment_date,
    settlementDate: row.settlement_date,
    confirmationDetails: row.confirmation_details,
    status: row.status,
    linkedInvoices: row.linked_invoices || [],
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createPayment(data: {
  tenantSlug: string;
  customerId?: string;
  invoiceId?: string;
  reference: string;
  grossAmount: number;
  fees: number;
  method: string;
  gateway?: string;
  gatewayReference?: string;
  paymentDate: string;
  settlementDate?: string;
  confirmationDetails: string;
  status?: string;
  linkedInvoices?: string[];
  metadata?: Record<string, unknown>;
}): Promise<FinancePayment> {
  const sql = SQL;
  await ensureFinanceTables(sql);

  const id = `PAY-${randomUUID().slice(0, 8)}`;
  const netAmount = data.grossAmount - data.fees;

  const row = (await sql`
    insert into finance_payments (
      id,
      tenant_slug,
      customer_id,
      invoice_id,
      reference,
      gross_amount,
      fees,
      net_amount,
      method,
      gateway,
      gateway_reference,
      payment_date,
      settlement_date,
      confirmation_details,
      status,
      linked_invoices,
      metadata
    ) values (
      ${id},
      ${data.tenantSlug},
      ${data.customerId ?? null},
      ${data.invoiceId ?? null},
      ${data.reference},
      ${data.grossAmount},
      ${data.fees},
      ${netAmount},
      ${data.method},
      ${data.gateway ?? null},
      ${data.gatewayReference ?? null},
      ${data.paymentDate},
      ${data.settlementDate ?? null},
      ${data.confirmationDetails},
      ${data.status ?? "pending"},
      ${data.linkedInvoices ? data.linkedInvoices : null},
      ${data.metadata ? JSON.stringify(data.metadata) : null}
    )
    returning *
  `) as FinancePaymentRecord[];

  return normalizePaymentRecord(row[0]);
}

export async function getPayment(id: string, tenantSlug: string): Promise<FinancePayment | null> {
  const sql = SQL;
  await ensureFinanceTables(sql);

  const rows = (await sql`
    select * from finance_payments
    where id = ${id} and tenant_slug = ${tenantSlug}
  `) as FinancePaymentRecord[];

  if (rows.length === 0) {
    return null;
  }

  return normalizePaymentRecord(rows[0]);
}

export async function listPayments(filters: {
  tenantSlug: string;
  status?: string;
  method?: string;
  invoiceId?: string;
  limit?: number;
  offset?: number;
}): Promise<FinancePayment[]> {
  const sql = SQL;
  await ensureFinanceTables(sql);

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
  const offset = Math.max(filters.offset ?? 0, 0);

  const baseQuery = sql`
    select * from finance_payments
    where tenant_slug = ${filters.tenantSlug}
    order by payment_date desc, created_at desc`;

  const rows = (await baseQuery) as FinancePaymentRecord[];

  let filtered = rows;

  if (filters.status) {
    filtered = filtered.filter(r => r.status === filters.status);
  }
  if (filters.method) {
    filtered = filtered.filter(r => r.method === filters.method);
  }
  if (filters.invoiceId) {
    filtered = filtered.filter(r => r.invoice_id === filters.invoiceId);
  }

  filtered = filtered.slice(offset, offset + limit);

  return filtered.map(normalizePaymentRecord);
}

export async function updatePayment(
  id: string,
  updates: {
    status?: string;
    settlementDate?: string;
    metadata?: Record<string, unknown>;
    linkedInvoices?: string[];
  }
): Promise<FinancePayment | null> {
  const sql = SQL;
  await ensureFinanceTables(sql);

  const [existing] = (await sql`
    select * from finance_payments where id = ${id}
  `) as (FinancePaymentRecord & { journal_entry_id?: string | null; reversed_journal_entry_id?: string | null })[];

  if (!existing) {
    return null;
  }

  // Reversing a successful payment reverses its journal entry and restores
  // the allocated invoice balances
  if (
    updates.status === "reversed" &&
    existing.status === "successful" &&
    existing.journal_entry_id &&
    !existing.reversed_journal_entry_id
  ) {
    try {
      const { reverseGLEntry } = await import("./gl");
      const reversal = await reverseGLEntry(
        existing.journal_entry_id,
        `Reverse payment ${existing.reference}`
      );

      const allocations = (await sql`
        select invoice_id, amount from payment_applications where payment_id = ${id}
      `) as { invoice_id: string; amount: number }[];

      for (const alloc of allocations) {
        await sql`
          update finance_invoices
          set balance_due = balance_due + ${Number(alloc.amount)},
              status = case when status = 'paid' then 'partially_paid' else status end,
              updated_at = now()
          where id = ${alloc.invoice_id}
        `;
      }

      await sql`update finance_payments set reversed_journal_entry_id = ${reversal.id} where id = ${id}`;
    } catch (err) {
      console.error("Failed to reverse payment journal entry:", err);
    }
  }

  const row = (await sql`
    update finance_payments
    set
      status = coalesce(${updates.status ?? null}, status),
      settlement_date = coalesce(${updates.settlementDate ?? null}, settlement_date),
      linked_invoices = coalesce(${updates.linkedInvoices ? updates.linkedInvoices : null}, linked_invoices),
      metadata = coalesce(${updates.metadata ? JSON.stringify(updates.metadata) : null}, metadata),
      updated_at = now()
    where id = ${id}
    returning *
  `) as FinancePaymentRecord[];

  if (row.length === 0) {
    return null;
  }

  return normalizePaymentRecord(row[0]);
}

export async function deletePayment(id: string): Promise<boolean> {
  const sql = SQL;
  await ensureFinanceTables(sql);

  const [existing] = (await sql`
    select status from finance_payments where id = ${id}
  `) as { status: string }[];

  if (!existing) {
    return false;
  }
  if (existing.status === "successful") {
    throw new Error("Successful payments cannot be deleted; reverse the payment instead");
  }

  const result = await db.query<{ count: number }>(`delete from finance_payments where id = $1`, [id]);
  return result.count > 0;
}

// Subscription Management Database Functions

export type FinanceSubscriptionRecord = {
  id: string;
  tenant_slug: string;
  plan: string;
  status: string;
  seats: number;
  price: number;
  features: string[] | null;
  next_billing_date: string | null;
  created_at: string;
  updated_at: string;
};

export type FinanceSubscription = {
  id: string;
  tenantSlug: string;
  plan: string;
  status: string;
  seats: number;
  price: number;
  features: string[];
  nextBillingDate: string | null;
  createdAt: string;
  updatedAt: string;
};

function normalizeSubscriptionRecord(row: FinanceSubscriptionRecord): FinanceSubscription {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    plan: row.plan,
    status: row.status,
    seats: Number(row.seats ?? 1),
    price: Number(row.price ?? 0),
    features: row.features || [],
    nextBillingDate: row.next_billing_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSubscriptions(tenantSlug: string): Promise<FinanceSubscription[]> {
  const sql = SQL;
  await ensureFinanceTables(sql);

  const rows = (await sql`
    select * from finance_subscriptions
    where tenant_slug = ${tenantSlug}
    order by created_at desc
  `) as FinanceSubscriptionRecord[];

  return rows.map(normalizeSubscriptionRecord);
}

export async function insertSubscription(data: {
  tenantSlug: string;
  plan: string;
  status?: string;
  seats?: number;
  price?: number;
  features?: string[];
  nextBillingDate?: string;
}): Promise<FinanceSubscription> {
  const sql = SQL;
  await ensureFinanceTables(sql);

  const id = `SUB-${randomUUID().slice(0, 8)}`;

  const row = (await sql`
    insert into finance_subscriptions (
      id, tenant_slug, plan, status, seats, price, features, next_billing_date
    ) values (
      ${id},
      ${data.tenantSlug},
      ${data.plan},
      ${data.status ?? "active"},
      ${data.seats ?? 1},
      ${data.price ?? 0},
      ${data.features ? data.features : null},
      ${data.nextBillingDate ?? null}
    )
    returning *
  `) as FinanceSubscriptionRecord[];

  // Keep tenants.seats (the enforced seat limit) in sync with the subscription.
  if (data.seats != null) {
    await sql`update tenants set seats = ${data.seats} where slug = ${data.tenantSlug}`;
  }

  return normalizeSubscriptionRecord(row[0]);
}

export async function updateSubscription(
  id: string,
  updates: {
    plan?: string;
    status?: string;
    seats?: number;
    price?: number;
    features?: string[];
    nextBillingDate?: string;
  },
  tenantSlug?: string
): Promise<FinanceSubscription | null> {
  const sql = SQL;
  await ensureFinanceTables(sql);

  const row = (await sql`
    update finance_subscriptions
    set
      plan = coalesce(${updates.plan ?? null}, plan),
      status = coalesce(${updates.status ?? null}, status),
      seats = coalesce(${updates.seats ?? null}, seats),
      price = coalesce(${updates.price ?? null}, price),
      features = coalesce(${updates.features ? updates.features : null}, features),
      next_billing_date = coalesce(${updates.nextBillingDate ?? null}, next_billing_date),
      updated_at = now()
    where id = ${id}
    ${tenantSlug ? sql`and tenant_slug = ${tenantSlug}` : sql``}
    returning *
  `) as FinanceSubscriptionRecord[];

  if (row.length === 0) return null;
  const updated = normalizeSubscriptionRecord(row[0]);
  // Keep tenants.seats (the enforced seat limit) in sync with the subscription.
  if (updates.seats != null && tenantSlug) {
    await sql`update tenants set seats = ${updates.seats} where slug = ${tenantSlug}`;
  }
  return updated;
}

export async function deleteSubscription(id: string, tenantSlug?: string): Promise<boolean> {
  const sql = SQL;
  await ensureFinanceTables(sql);

  const result = tenantSlug
    ? await db.query<{ count: number }>(`delete from finance_subscriptions where id = $1 and tenant_slug = $2`, [id, tenantSlug])
    : await db.query<{ count: number }>(`delete from finance_subscriptions where id = $1`, [id]);
  return result.count > 0;
}

// Expense Management Database Functions

import type {
  Expense,
  ExpenseCreateInput,
  ExpenseUpdateInput,
  ExpenseApproveInput,
  ExpenseCategory,
  ExpenseApproval,
  ExpenseAuditLog,
} from "@/lib/finance/types";
import { ensureOnce } from "@/lib/ensure-once";

export type ExpenseRecord = {
  id: string;
  tenant_slug: string;
  region_id: string | null;
  branch_id: string | null;
  type: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  currency: string | null;
  tax_type: string;
  category: string;
  category_id: string;
  description: string;
  vendor: string | null;
  date: string;
  approval_status: string;
  payment_status: string;
  gl_account_id: string | null;
  notes: string | null;
  attachments: string[] | null;
  prepaid_schedule: unknown;
  metadata: unknown;
  department_id: string | null;
  submitter_employee_id: string | null;
  approval_id: string | null;
  journal_entry_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
};

export type ExpenseApprovalRecord = {
  id: string;
  expense_id: string;
  approver_role: string;
  approver_id: string;
  approver_name: string;
  action: string;
  reason: string | null;
  timestamp: string;
  amount_threshold: number;
};

export type ExpenseAuditLogRecord = {
  id: string;
  expense_id: string;
  action: string;
  timestamp: string;
  user_id: string;
  details: unknown;
};

export type ExpenseCategoryRecord = {
  id: string;
  code: string;
  name: string;
  account_id: string;
  requires_vendor: boolean;
  requires_receipt: boolean;
  category_limit: number | null;
  policy_description: string | null;
};

export function ensureExpenseTables(...args: Parameters<typeof ensureExpenseTablesRun>) {
  return ensureOnce("finance/db:ensureExpenseTables", () => ensureExpenseTablesRun(...args));
}

async function ensureExpenseTablesRun(sql: SqlClient = SQL) {
  await sql`
    create table if not exists expense_categories (
      id text primary key,
      code text not null unique,
      name text not null,
      account_id text not null,
      requires_vendor boolean default false,
      requires_receipt boolean default false,
      category_limit numeric,
      policy_description text,
      created_at timestamptz default now()
    )
  `;

  await sql`
    create table if not exists expenses (
      id text primary key,
      tenant_slug text not null,
      region_id text,
      branch_id text,
      type text not null check (type in ('vendor', 'reimbursement', 'cash', 'prepaid')),
      amount numeric not null,
      tax_amount numeric not null default 0,
      total_amount numeric not null,
      tax_type text not null check (tax_type in ('VAT', 'WHT', 'NONE')),
      category text not null,
      category_id text not null references expense_categories (id),
      description text not null,
      vendor text,
      date date not null,
      approval_status text not null default 'DRAFT' check (approval_status in ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CLARIFY_NEEDED')),
      payment_status text not null default 'UNPAID' check (payment_status in ('UNPAID', 'PAID', 'REIMBURSED', 'PENDING')),
      gl_account_id text,
      notes text,
      attachments text[] default array[]::text[],
      prepaid_schedule jsonb,
      metadata jsonb,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      created_by text not null
    )
  `;

  await sql`
    create table if not exists expense_approvals (
      id text primary key,
      expense_id text not null references expenses (id) on delete cascade,
      approver_role text not null check (approver_role in ('MANAGER', 'FINANCE', 'EXECUTIVE')),
      approver_id text not null,
      approver_name text not null,
      action text not null check (action in ('APPROVED', 'REJECTED', 'PENDING', 'CLARIFY_NEEDED')),
      reason text,
      timestamp timestamptz default now(),
      amount_threshold numeric not null,
      created_at timestamptz default now()
    )
  `;

  await sql`
    create table if not exists expense_audit_logs (
      id text primary key,
      expense_id text not null references expenses (id) on delete cascade,
      action text not null,
      timestamp timestamptz default now(),
      user_id text not null,
      details jsonb,
      created_at timestamptz default now()
    )
  `;

  await sql`
    create table if not exists expense_receipts (
      id text primary key,
      expense_id text not null references expenses (id) on delete cascade,
      filename text not null,
      mime_type text not null,
      data text not null,
      size_bytes integer not null default 0,
      created_at timestamptz default now()
    )
  `;

  // Approval-workflow linkage: which department's authority decides, who the
  // submitter maps to in admin_employees, the approvals workflow row, and the
  // GL entry posted on final approval.
  await sql`
    alter table expenses
      add column if not exists department_id text,
      add column if not exists submitter_employee_id text,
      add column if not exists approval_id text,
      add column if not exists journal_entry_id text
  `;

  await Promise.all([
    sql`create index if not exists expenses_tenant_idx on expenses (tenant_slug, approval_status)`,
    sql`create index if not exists expenses_department_idx on expenses (tenant_slug, department_id)`,
    sql`create index if not exists expenses_category_idx on expenses (category_id, approval_status)`,
    sql`create index if not exists expenses_date_idx on expenses (date)`,
    sql`create index if not exists expense_approvals_expense_idx on expense_approvals (expense_id)`,
    sql`create index if not exists expense_audit_logs_expense_idx on expense_audit_logs (expense_id)`,
    sql`create index if not exists expense_receipts_expense_idx on expense_receipts (expense_id)`,
  ]);
}

export async function saveReceipt(params: {
  expenseId: string;
  filename: string;
  mimeType: string;
  data: string; // base64
  tenantSlug?: string;
}): Promise<{ id: string; filename: string; mimeType: string; size: number; url: string; createdAt: string }> {
  const sql = SQL;
  await ensureExpenseTables(sql);
  const id = randomUUID();

  const fileBuffer = Buffer.from(params.data, "base64");

  let tenantSlug = params.tenantSlug;
  if (!tenantSlug) {
    const tenantRows = await sql`select tenant_slug from expenses where id = ${params.expenseId} limit 1` as any[];
    tenantSlug = tenantRows[0]?.tenant_slug ?? "default";
  }

  const uploadResult = await uploadReceipt({
    filename: params.filename,
    mimeType: params.mimeType,
    data: fileBuffer,
    expenseId: params.expenseId,
    tenantSlug,
  });

  if (!uploadResult.success || !uploadResult.url) {
    throw new Error(uploadResult.error || "Receipt upload failed");
  }

  const [row] = await sql`
    insert into expense_receipts (id, expense_id, filename, mime_type, data, size_bytes)
    values (${id}, ${params.expenseId}, ${params.filename}, ${params.mimeType}, ${uploadResult.url}, ${uploadResult.size ?? 0})
    returning id, filename, mime_type, data, size_bytes, created_at
  ` as any[];

  // Also update the expense attachments array
  await sql`
    update expenses
    set attachments = array_append(coalesce(attachments, array[]::text[]), ${params.filename}),
        updated_at = now()
    where id = ${params.expenseId}
  `;

  return {
    id: row.id,
    filename: row.filename,
    mimeType: row.mime_type,
    size: row.size_bytes,
    url: row.data,
    createdAt: row.created_at,
  };
}

function normalizeExpenseRecord(
  record: ExpenseRecord,
  approvals: Array<ExpenseApprovalRecord | ExpenseApproval> = [],
  auditLogs: ExpenseAuditLogRecord[] = []
): Expense {
  const normApprovals = approvals.map((a) => {
    // support both DB record shape (snake_case) and DTO shape (camelCase)
    const id = (a as any).id;
    const expenseId = (a as any).expense_id ?? (a as any).expenseId;
    const approverRole = (a as any).approver_role ?? (a as any).approverRole;
    const approverId = (a as any).approver_id ?? (a as any).approverId;
    const approverName = (a as any).approver_name ?? (a as any).approverName;
    const action = (a as any).action;
    const reason = (a as any).reason;
    const timestamp = (a as any).timestamp;
    const amountThreshold = (a as any).amount_threshold ?? (a as any).amountThreshold ?? 0;

    return {
      id,
      expenseId,
      approverRole: approverRole as any,
      approverId,
      approverName,
      action: action as any,
      reason,
      timestamp,
      amountThreshold: Number(amountThreshold),
    } as ExpenseApproval;
  });

  return {
    id: record.id,
    tenantSlug: record.tenant_slug,
    regionId: record.region_id,
    branchId: record.branch_id,
    type: record.type as any,
    amount: Number(record.amount),
    taxAmount: Number(record.tax_amount),
    totalAmount: Number(record.total_amount),
    currency: record.currency ?? "NGN",
    taxType: record.tax_type as any,
    category: record.category,
    categoryId: record.category_id,
    description: record.description,
    vendor: record.vendor,
    date: record.date,
    approvalStatus: record.approval_status as any,
    paymentStatus: record.payment_status as any,
    approvals: normApprovals,
    auditLog: auditLogs.map(l => ({
      id: l.id,
      expenseId: l.expense_id,
      action: l.action,
      timestamp: l.timestamp,
      user: l.user_id,
      details: l.details as Record<string, unknown> | null,
    })),
    glAccountId: record.gl_account_id,
    notes: record.notes,
    attachments: record.attachments,
    prepaidSchedule: record.prepaid_schedule as Record<string, unknown> | null,
    metadata: record.metadata as Record<string, unknown> | null,
    departmentId: record.department_id ?? null,
    submitterEmployeeId: record.submitter_employee_id ?? null,
    approvalId: record.approval_id ?? null,
    journalEntryId: record.journal_entry_id ?? null,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    createdBy: record.created_by,
  };
}

export async function listExpenses(filters: {
  tenantSlug: string;
  approvalStatus?: string;
  paymentStatus?: string;
  categoryId?: string;
  createdBy?: string;
  departmentId?: string;
  limit?: number;
  offset?: number;
}): Promise<Expense[]> {
  const sql = SQL;
  await ensureExpenseTables(sql);
  
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
  const offset = Math.max(filters.offset ?? 0, 0);
  
  const queryText = `select e.*, 
           array_agg(row_to_json(ea.*)) filter (where ea.id is not null) as approvals_agg,
           array_agg(row_to_json(eal.*)) filter (where eal.id is not null) as audit_agg
    from expenses e
    left join expense_approvals ea on e.id = ea.expense_id
    left join expense_audit_logs eal on e.id = eal.expense_id
    where e.tenant_slug = $1
    group by e.id
    order by e.created_at desc`;

  // For simplicity, query without additional filters first, then filter in memory if needed
  // This avoids the SQL template concatenation issue
  const rows = (await db.query<any>(queryText, [filters.tenantSlug])).rows;
  
  // Apply filters in memory
  let filtered = rows;
  
  if (filters.approvalStatus) {
    filtered = filtered.filter(r => r.approval_status === filters.approvalStatus);
  }
  if (filters.paymentStatus) {
    filtered = filtered.filter(r => r.payment_status === filters.paymentStatus);
  }
  if (filters.categoryId) {
    filtered = filtered.filter(r => r.category_id === filters.categoryId);
  }
  if (filters.createdBy) {
    filtered = filtered.filter(r => r.created_by === filters.createdBy);
  }
  if (filters.departmentId) {
    filtered = filtered.filter(r => r.department_id === filters.departmentId);
  }
  
  // Apply pagination
  filtered = filtered.slice(offset, offset + limit);
  
  return filtered.map(r => normalizeExpenseRecord(r as ExpenseRecord, r.approvals_agg || [], r.audit_agg || []));
}

export async function getExpense(id: string, tenantSlug: string): Promise<Expense | null> {
  const sql = SQL;
  await ensureExpenseTables(sql);

  const rows = (await sql`
    select e.*, 
           array_agg(row_to_json(ea.*)) filter (where ea.id is not null) as approvals_agg,
           array_agg(row_to_json(eal.*)) filter (where eal.id is not null) as audit_agg
    from expenses e
    left join expense_approvals ea on e.id = ea.expense_id
    left join expense_audit_logs eal on e.id = eal.expense_id
    where e.id = ${id} and e.tenant_slug = ${tenantSlug}
    group by e.id
  `) as any[];

  if (rows.length === 0) return null;
  const row = rows[0];
  return normalizeExpenseRecord(row as ExpenseRecord, row.approvals_agg || [], row.audit_agg || []);
}

export async function createExpense(payload: ExpenseCreateInput): Promise<Expense> {
  const sql = SQL;
  await ensureExpenseTables(sql);
  
  const id = randomUUID();
  const taxAmount = payload.taxType === "NONE" 
    ? 0 
    : payload.taxType === "VAT"
    ? payload.amount * 0.075
    : payload.amount * 0.05;
  
  const totalAmount = payload.amount + taxAmount;

  const [record] = (await sql`
    insert into expenses (
      id,
      tenant_slug,
      region_id,
      branch_id,
      type,
      amount,
      tax_amount,
      total_amount,
      tax_type,
      category,
      category_id,
      description,
      vendor,
      date,
      approval_status,
      payment_status,
      notes,
      attachments,
      metadata,
      department_id,
      submitter_employee_id,
      created_by
    ) values (
      ${id},
      ${payload.tenantSlug},
      ${payload.regionId ?? null},
      ${payload.branchId ?? null},
      ${payload.type},
      ${payload.amount},
      ${taxAmount},
      ${totalAmount},
      ${payload.taxType},
      ${payload.category},
      ${payload.categoryId},
      ${payload.description},
      ${payload.vendor ?? null},
      ${payload.date},
      ${payload.approvalStatus ?? "DRAFT"},
      ${payload.paymentStatus ?? "UNPAID"},
      ${payload.notes ?? null},
      ${payload.attachments && payload.attachments.length > 0 ? sql`${payload.attachments}::text[]` : null},
      ${payload.metadata ? JSON.stringify(payload.metadata) : null},
      ${payload.departmentId ?? null},
      ${payload.submitterEmployeeId ?? null},
      ${payload.createdBy}
    )
    returning *
  `) as ExpenseRecord[];

  // Create initial audit log
  await sql`
    insert into expense_audit_logs (id, expense_id, action, user_id, details)
    values (${randomUUID()}, ${id}, 'CREATED', ${payload.createdBy}, ${JSON.stringify({ type: payload.type, amount: payload.amount })})
  `;

  return normalizeExpenseRecord(record);
}

export async function updateExpense(id: string, tenantSlug: string, updates: ExpenseUpdateInput): Promise<Expense | null> {
  const sql = SQL;
  await ensureExpenseTables(sql);

  // Get current expense for audit
  const current = await getExpense(id, tenantSlug);
  if (!current) return null;

  const taxAmount = updates.taxType 
    ? updates.taxType === "NONE" 
      ? 0 
      : updates.taxType === "VAT"
      ? (updates.amount ?? current.amount) * 0.075
      : (updates.amount ?? current.amount) * 0.05
    : current.taxAmount;
  
  const totalAmount = (updates.amount ?? current.amount) + taxAmount;

  const [record] = (await sql`
    update expenses
    set
      type = ${updates.type ?? current.type},
      amount = ${updates.amount ?? current.amount},
      tax_amount = ${taxAmount},
      total_amount = ${totalAmount},
      tax_type = ${updates.taxType ?? current.taxType},
      category = ${updates.category ?? current.category},
      category_id = ${updates.categoryId ?? current.categoryId},
      description = ${updates.description ?? current.description},
      vendor = ${updates.vendor !== undefined ? updates.vendor : current.vendor},
      date = ${updates.date ?? current.date},
      approval_status = ${updates.approvalStatus ?? current.approvalStatus},
      payment_status = ${updates.paymentStatus ?? current.paymentStatus},
      notes = ${updates.notes !== undefined ? updates.notes : current.notes},
      updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug}
    returning *
  `) as ExpenseRecord[];

  // Create audit log
  await sql`
    insert into expense_audit_logs (id, expense_id, action, user_id, details)
    values (${randomUUID()}, ${id}, 'UPDATED', 'system', ${JSON.stringify({ updates })})
  `;

  return normalizeExpenseRecord(record);
}

export async function deleteExpense(id: string, tenantSlug: string): Promise<boolean> {
  const sql = SQL;
  await ensureExpenseTables(sql);

  const result = await sql`
    delete from expenses
    where id = ${id} and tenant_slug = ${tenantSlug}
    returning id
  `;

  return (result as any[]).length > 0;
}

export async function approveExpense(expenseId: string, tenantSlug: string, approval: ExpenseApproveInput): Promise<Expense | null> {
  const sql = SQL;
  await ensureExpenseTables(sql);

  const current = await getExpense(expenseId, tenantSlug);
  if (!current) return null;

  // Insert approval record
  const approvalId = randomUUID();
  await sql`
    insert into expense_approvals (
      id,
      expense_id,
      approver_role,
      approver_id,
      approver_name,
      action,
      reason,
      amount_threshold
    ) values (
      ${approvalId},
      ${expenseId},
      ${approval.approverRole ?? "FINANCE"},
      ${approval.approverId ?? "system"},
      ${approval.approverName ?? "System"},
      ${approval.action},
      ${approval.reason ?? null},
      ${current.amount}
    )
  `;

  // Update expense status if fully approved
  let newStatus = current.approvalStatus;
  if (approval.action === "APPROVED") {
    // Check if all required approvals are done
    const approvalsNeeded = current.amount > 500000 ? 3 : current.amount > 50000 ? 2 : 1;
    const approvalCount = current.approvals.length + 1;
    
    if (approvalCount >= approvalsNeeded) {
      newStatus = "APPROVED";
    } else {
      newStatus = "PENDING";
    }
  } else if (approval.action === "REJECTED") {
    newStatus = "REJECTED";
  } else if (approval.action === "CLARIFY_NEEDED") {
    newStatus = "CLARIFY_NEEDED";
  }

  const [record] = (await sql`
    update expenses
    set approval_status = ${newStatus}, updated_at = now()
    where id = ${expenseId}
    returning *
  `) as ExpenseRecord[];

  // Create audit log
  await sql`
    insert into expense_audit_logs (id, expense_id, action, user_id, details)
    values (${randomUUID()}, ${expenseId}, 'APPROVAL_' || ${approval.action}, ${approval.approverId ?? "system"}, ${JSON.stringify({ approverRole: approval.approverRole ?? "FINANCE", reason: approval.reason })})
  `;

  return normalizeExpenseRecord(record, current.approvals);
}

export async function seedExpenseCategories(sql: SqlClient = SQL) {
  await ensureExpenseTables(sql);

  const categories = [
    // Office & Operations
    { code: "SUPPLIES", name: "Office Supplies", accountId: "6020", requiresVendor: true },
    { code: "RENT", name: "Rent & Lease", accountId: "6100", requiresVendor: true },
    { code: "UTILITIES", name: "Utilities (Electricity, Water, Gas)", accountId: "6110", requiresVendor: true },
    { code: "INTERNET", name: "Internet & Telecommunications", accountId: "6120", requiresVendor: true },
    { code: "MAINTENANCE", name: "Repairs & Maintenance", accountId: "6130", requiresVendor: true },
    { code: "CLEANING", name: "Cleaning & Janitorial", accountId: "6140", requiresVendor: true },
    { code: "SECURITY", name: "Security Services", accountId: "6150", requiresVendor: true },
    { code: "FURNITURE", name: "Furniture & Equipment", accountId: "6160", requiresVendor: true },
    { code: "PRINTING", name: "Printing & Stationery", accountId: "6170", requiresVendor: false },
    // Travel & Transport
    { code: "TRAVEL", name: "Travel", accountId: "6010", requiresVendor: true },
    { code: "TRANSPORT", name: "Transportation & Logistics", accountId: "6200", requiresVendor: false },
    { code: "FUEL", name: "Fuel & Vehicle Expenses", accountId: "6210", requiresVendor: false },
    { code: "ACCOMMODATION", name: "Accommodation & Lodging", accountId: "6220", requiresVendor: true },
    { code: "MEALS", name: "Meals & Entertainment", accountId: "6030", requiresVendor: false },
    // Technology & Software
    { code: "SOFTWARE", name: "Software & Subscriptions", accountId: "6060", requiresVendor: true },
    { code: "HARDWARE", name: "Computer Hardware & Devices", accountId: "6310", requiresVendor: true },
    { code: "CLOUD", name: "Cloud Services & Hosting", accountId: "6320", requiresVendor: true },
    { code: "IT_SUPPORT", name: "IT Support & Services", accountId: "6330", requiresVendor: true },
    // HR & People
    { code: "TRAINING", name: "Training & Development", accountId: "6070", requiresVendor: false },
    { code: "RECRUITMENT", name: "Recruitment & Hiring", accountId: "6410", requiresVendor: true },
    { code: "BENEFITS", name: "Employee Benefits & Welfare", accountId: "6420", requiresVendor: false },
    { code: "RELOCATION", name: "Relocation & Moving", accountId: "6430", requiresVendor: true },
    { code: "CONFERENCES", name: "Conferences & Events", accountId: "6440", requiresVendor: true },
    // Professional & Legal
    { code: "PROFESSIONAL", name: "Professional Services", accountId: "6050", requiresVendor: true },
    { code: "LEGAL", name: "Legal Fees", accountId: "6510", requiresVendor: true },
    { code: "ACCOUNTING", name: "Accounting & Audit Fees", accountId: "6520", requiresVendor: true },
    { code: "CONSULTING", name: "Consulting Fees", accountId: "6530", requiresVendor: true },
    { code: "LICENSES", name: "Licenses & Permits", accountId: "6540", requiresVendor: true },
    // Marketing & Sales
    { code: "ADVERTISING", name: "Advertising & Promotions", accountId: "6610", requiresVendor: true },
    { code: "MARKETING", name: "Marketing & Branding", accountId: "6620", requiresVendor: true },
    { code: "CLIENT_GIFTS", name: "Client Gifts & Entertainment", accountId: "6630", requiresVendor: false },
    { code: "SPONSORSHIP", name: "Sponsorship & Donations", accountId: "6640", requiresVendor: false },
    // Insurance & Compliance
    { code: "INSURANCE", name: "Insurance", accountId: "6040", requiresVendor: true },
    { code: "TAXES", name: "Taxes & Government Levies", accountId: "6710", requiresVendor: false },
    { code: "COMPLIANCE", name: "Regulatory & Compliance Fees", accountId: "6720", requiresVendor: true },
    // Finance & Banking
    { code: "BANK_CHARGES", name: "Bank Charges & Fees", accountId: "6810", requiresVendor: false },
    { code: "INTEREST", name: "Interest & Loan Repayment", accountId: "6820", requiresVendor: false },
    { code: "SUBSCRIPTIONS", name: "Subscriptions & Memberships", accountId: "6830", requiresVendor: true },
    // Miscellaneous
    { code: "SHIPPING", name: "Shipping & Courier", accountId: "6910", requiresVendor: true },
    { code: "WASTE", name: "Waste Disposal & Recycling", accountId: "6920", requiresVendor: true },
    { code: "PETTY_CASH", name: "Petty Cash", accountId: "6930", requiresVendor: false },
    { code: "OTHER", name: "Other", accountId: "6090", requiresVendor: false },
  ];

  for (const cat of categories) {
    const id = `cat_${cat.code.toLowerCase()}`;
    const existing = await sql`select id from expense_categories where id = ${id}`;
    
    if ((existing as any[]).length === 0) {
      await sql`
        insert into expense_categories (id, code, name, account_id, requires_vendor, requires_receipt)
        values (${id}, ${cat.code}, ${cat.name}, ${cat.accountId}, ${cat.requiresVendor}, true)
      `;
    }
  }
}