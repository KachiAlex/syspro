import { randomUUID } from "node:crypto";

import { getSql } from "@/lib/db";
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

const SQL = getSql();

type SqlClient = ReturnType<typeof getSql>;

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

export async function ensureFinanceTables(sql: SqlClient = SQL) {
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

  await Promise.all([
    sql`create index if not exists finance_accounts_tenant_idx on finance_accounts (tenant_slug)`,
    sql`create index if not exists finance_schedules_tenant_idx on finance_schedules (tenant_slug, document_type)`,
    sql`create index if not exists finance_expense_categories_tenant_idx on finance_expense_categories (tenant_slug)`,
    sql`create index if not exists finance_trend_points_tenant_idx on finance_trend_points (tenant_slug, timeframe)`,
    sql`create index if not exists finance_invoices_tenant_idx on finance_invoices (tenant_slug, status)`,
    sql`create index if not exists finance_invoice_lines_invoice_idx on finance_invoice_lines (invoice_id)`,
    sql`create index if not exists finance_payments_tenant_idx on finance_payments (tenant_slug, status)`,
    sql`create index if not exists finance_payments_invoice_idx on finance_payments (invoice_id)`,
  ]);
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
      trend
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
      ${payload.trend ?? "up"}
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
    updates.trend === undefined
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
  const lineRows = (await Promise.all(
    payload.lineItems.map((line) =>
      sql`
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
      `
    )
  )).flat() as FinanceInvoiceLineRecord[];

  return normalizeFinanceInvoiceRow(invoiceRow, lineRows);
}

export async function updateFinanceInvoice(
  id: string,
  updates: FinanceInvoiceUpdateInput
): Promise<FinanceInvoice | null> {
  const sql = SQL;
  await ensureFinanceTables(sql);

  const [invoiceRow] = (await sql`
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
    returning *
  `) as FinanceInvoiceRecord[];

  if (!invoiceRow) {
    return null;
  }

  let lineRows: FinanceInvoiceLineRecord[] | null = null;
  if (updates.lineItems && updates.lineItems.length) {
    await sql`delete from finance_invoice_lines where invoice_id = ${id}`;
    lineRows = (
      await Promise.all(
        updates.lineItems.map((line) =>
          sql`
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
          `
        )
      )
    ).flat();
  }

  if (!lineRows) {
    lineRows = (await sql`
      select * from finance_invoice_lines where invoice_id = ${id}
    `) as FinanceInvoiceLineRecord[];
  }

  return normalizeFinanceInvoiceRow(invoiceRow, lineRows);
}

export async function deleteFinanceInvoice(id: string): Promise<boolean> {
  const sql = SQL;
  await ensureFinanceTables(sql);

  const result = await sql`
    delete from finance_invoices where id = ${id}
  `;

  return result.count > 0;
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
      ${data.linkedInvoices ? JSON.stringify(data.linkedInvoices) : null},
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

  const row = (await sql`
    update finance_payments
    set
      status = coalesce(${updates.status ?? null}, status),
      settlement_date = coalesce(${updates.settlementDate ?? null}, settlement_date),
      linked_invoices = coalesce(${updates.linkedInvoices ? JSON.stringify(updates.linkedInvoices) : null}, linked_invoices),
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

  const result = await sql`
    delete from finance_payments where id = ${id}
  `;

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

export type ExpenseRecord = {
  id: string;
  tenant_slug: string;
  region_id: string | null;
  branch_id: string | null;
  type: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
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

export async function ensureExpenseTables(sql: SqlClient = SQL) {
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

  await Promise.all([
    sql`create index if not exists expenses_tenant_idx on expenses (tenant_slug, approval_status)`,
    sql`create index if not exists expenses_category_idx on expenses (category_id, approval_status)`,
    sql`create index if not exists expenses_date_idx on expenses (date)`,
    sql`create index if not exists expense_approvals_expense_idx on expense_approvals (expense_id)`,
    sql`create index if not exists expense_audit_logs_expense_idx on expense_audit_logs (expense_id)`,
  ]);
}

function normalizeExpenseRecord(record: ExpenseRecord, approvals: ExpenseApprovalRecord[] = [], auditLogs: ExpenseAuditLogRecord[] = []): Expense {
  return {
    id: record.id,
    tenantSlug: record.tenant_slug,
    regionId: record.region_id,
    branchId: record.branch_id,
    type: record.type as any,
    amount: Number(record.amount),
    taxAmount: Number(record.tax_amount),
    totalAmount: Number(record.total_amount),
    taxType: record.tax_type as any,
    category: record.category,
    categoryId: record.category_id,
    description: record.description,
    vendor: record.vendor,
    date: record.date,
    approvalStatus: record.approval_status as any,
    paymentStatus: record.payment_status as any,
    approvals: approvals.map(a => ({
      id: a.id,
      expenseId: a.expense_id,
      approverRole: a.approver_role as any,
      approverId: a.approver_id,
      approverName: a.approver_name,
      action: a.action as any,
      reason: a.reason,
      timestamp: a.timestamp,
      amountThreshold: Number(a.amount_threshold),
    })),
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
  limit?: number;
  offset?: number;
}): Promise<Expense[]> {
  const sql = SQL;
  await ensureExpenseTables(sql);
  
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
  const offset = Math.max(filters.offset ?? 0, 0);
  
  const baseQuery = sql`
    select e.*, 
           array_agg(row_to_json(ea.*)) filter (where ea.id is not null) as approvals_agg,
           array_agg(row_to_json(eal.*)) filter (where eal.id is not null) as audit_agg
    from expenses e
    left join expense_approvals ea on e.id = ea.expense_id
    left join expense_audit_logs eal on e.id = eal.expense_id
    where e.tenant_slug = ${filters.tenantSlug}
    group by e.id
    order by e.created_at desc`;
  
  // For simplicity, query without additional filters first, then filter in memory if needed
  // This avoids the SQL template concatenation issue
  const rows = (await baseQuery) as any[];
  
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
      ${payload.attachments ? JSON.stringify(payload.attachments) : null},
      ${payload.metadata ? JSON.stringify(payload.metadata) : null},
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
      ${approval.approverRole},
      ${approval.approverId},
      ${approval.approverName},
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
    values (${randomUUID()}, ${expenseId}, 'APPROVAL_' || ${approval.action}, ${approval.approverId}, ${JSON.stringify({ approverRole: approval.approverRole, reason: approval.reason })})
  `;

  return normalizeExpenseRecord(record, current.approvals);
}

export async function seedExpenseCategories(sql: SqlClient = SQL) {
  await ensureExpenseTables(sql);

  const categories = [
    { code: "TRAVEL", name: "Travel", accountId: "6010", requiresVendor: true },
    { code: "SUPPLIES", name: "Office Supplies", accountId: "6020", requiresVendor: true },
    { code: "MEALS", name: "Meals & Entertainment", accountId: "6030", requiresVendor: false },
    { code: "INSURANCE", name: "Insurance", accountId: "6040", requiresVendor: true },
    { code: "PROFESSIONAL", name: "Professional Services", accountId: "6050", requiresVendor: true },
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