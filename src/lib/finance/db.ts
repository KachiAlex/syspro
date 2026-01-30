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

  await Promise.all([
    sql`create index if not exists finance_accounts_tenant_idx on finance_accounts (tenant_slug)`,
    sql`create index if not exists finance_schedules_tenant_idx on finance_schedules (tenant_slug, document_type)`,
    sql`create index if not exists finance_expense_categories_tenant_idx on finance_expense_categories (tenant_slug)`,
    sql`create index if not exists finance_trend_points_tenant_idx on finance_trend_points (tenant_slug, timeframe)`,
    sql`create index if not exists finance_invoices_tenant_idx on finance_invoices (tenant_slug, status)`,
    sql`create index if not exists finance_invoice_lines_invoice_idx on finance_invoice_lines (invoice_id)`,
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
  const rows = (await sql`
    select *
    from finance_accounts
    where tenant_slug = ${filters.tenantSlug}
      ${filters.regionId ? sql`and (region_id is null or region_id = ${filters.regionId})` : sql``}
      ${filters.branchId ? sql`and (branch_id is null or branch_id = ${filters.branchId})` : sql``}
    order by balance desc
    ${filters.limit ? sql`limit ${filters.limit}` : sql``}
    ${filters.offset ? sql`offset ${filters.offset}` : sql``}
  `) as FinanceAccountRecord[];
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
  const rows = (await sql`
    select *
    from finance_invoices
    where tenant_slug = ${filters.tenantSlug}
      ${filters.status ? sql`and status = ${filters.status}` : sql``}
      ${filters.regionId ? sql`and (region_id is null or region_id = ${filters.regionId})` : sql``}
      ${filters.branchId ? sql`and (branch_id is null or branch_id = ${filters.branchId})` : sql``}
    order by issued_date desc, created_at desc
    ${filters.limit ? sql`limit ${filters.limit}` : sql``}
    ${filters.offset ? sql`offset ${filters.offset}` : sql``}
  `) as FinanceInvoiceRecord[];

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

  const rows = await sql.begin(async (transaction) => {
    const [invoiceRow] = (await transaction`
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

    const lineRows = await Promise.all(
      payload.lineItems.map((line) =>
        transaction`
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
    );

    return [invoiceRow[0], lineRows.flat()] as [FinanceInvoiceRecord, FinanceInvoiceLineRecord[]];
  });

  const [invoiceRow, lineRows] = rows;
  return normalizeFinanceInvoiceRow(invoiceRow, lineRows);
}

export async function updateFinanceInvoice(
  id: string,
  updates: FinanceInvoiceUpdateInput
): Promise<FinanceInvoice | null> {
  const sql = SQL;
  await ensureFinanceTables(sql);

  const updated = await sql.begin(async (transaction) => {
    const [invoiceRow] = (await transaction`
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
      await transaction`delete from finance_invoice_lines where invoice_id = ${id}`;
      lineRows = (
        await Promise.all(
          updates.lineItems.map((line) =>
            transaction`
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
      lineRows = (await transaction`
        select * from finance_invoice_lines where invoice_id = ${id}
      `) as FinanceInvoiceLineRecord[];
    }

    return [invoiceRow, lineRows] as [FinanceInvoiceRecord, FinanceInvoiceLineRecord[]];
  });

  if (!updated) {
    return null;
  }

  const [invoiceRow, lineRows] = updated;
  return normalizeFinanceInvoiceRow(invoiceRow, lineRows);
}
