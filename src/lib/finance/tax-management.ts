import { randomUUID } from "crypto";
import { sql as SQL, SqlClient } from "../sql-client";

export interface TaxRate {
  id: string;
  tenantSlug: string;
  taxType: "vat" | "wht" | "paye" | "company_tax" | "custom";
  name: string;
  rate: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface TaxReturn {
  id: string;
  tenantSlug: string;
  taxType: string;
  periodStart: string;
  periodEnd: string;
  totalTaxCollected: number;
  totalTaxPaid: number;
  totalTaxWithheld: number;
  netTaxPayable: number;
  status: "draft" | "filed" | "paid" | "overdue";
  filedDate: string | null;
  paidDate: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaxTransaction {
  id: string;
  tenantSlug: string;
  taxReturnId: string | null;
  transactionType: "sales" | "purchase" | "wht_deducted" | "wht_received" | "vat_output" | "vat_input";
  sourceType: "invoice" | "bill" | "payment" | "manual";
  sourceId: string | null;
  transactionDate: string;
  description: string;
  baseAmount: number;
  taxRate: number;
  taxAmount: number;
  createdAt: string;
}

export async function ensureTaxTables(sql: SqlClient = SQL) {
  await sql`
    create table if not exists tax_rates (
      id text primary key,
      tenant_slug text not null,
      tax_type text not null check (tax_type in ('vat', 'wht', 'paye', 'company_tax', 'custom')),
      name text not null,
      rate numeric not null,
      effective_from date not null,
      effective_to date,
      is_active boolean not null default true,
      created_at timestamptz default now()
    )
  `;

  await sql`
    create table if not exists tax_returns (
      id text primary key,
      tenant_slug text not null,
      tax_type text not null,
      period_start date not null,
      period_end date not null,
      total_tax_collected numeric not null default 0,
      total_tax_paid numeric not null default 0,
      total_tax_withheld numeric not null default 0,
      net_tax_payable numeric not null default 0,
      status text not null default 'draft' check (status in ('draft', 'filed', 'paid', 'overdue')),
      filed_date date,
      paid_date date,
      reference text,
      notes text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`
    create table if not exists tax_transactions (
      id text primary key,
      tenant_slug text not null,
      tax_return_id text references tax_returns (id) on delete set null,
      transaction_type text not null check (transaction_type in ('sales', 'purchase', 'wht_deducted', 'wht_received', 'vat_output', 'vat_input')),
      source_type text not null check (source_type in ('invoice', 'bill', 'payment', 'manual')),
      source_id text,
      transaction_date date not null,
      description text not null,
      base_amount numeric not null,
      tax_rate numeric not null,
      tax_amount numeric not null,
      created_at timestamptz default now()
    )
  `;

  await sql`create index if not exists tax_rates_tenant_idx on tax_rates (tenant_slug)`;
  await sql`create index if not exists tax_returns_tenant_idx on tax_returns (tenant_slug, status)`;
  await sql`create index if not exists tax_transactions_tenant_idx on tax_transactions (tenant_slug, transaction_date)`;
}

export async function createTaxRate(data: {
  tenantSlug: string;
  taxType: string;
  name: string;
  rate: number;
  effectiveFrom: string;
  effectiveTo?: string;
}): Promise<TaxRate> {
  const sql = SQL;
  await ensureTaxTables(sql);

  const id = randomUUID();
  const [row] = (await sql`
    insert into tax_rates (id, tenant_slug, tax_type, name, rate, effective_from, effective_to, is_active)
    values (${id}, ${data.tenantSlug}, ${data.taxType}, ${data.name}, ${data.rate}, ${data.effectiveFrom}, ${data.effectiveTo ?? null}, true)
    returning *
  `) as any[];

  return normalizeTaxRate(row);
}

export async function listTaxRates(tenantSlug: string): Promise<TaxRate[]> {
  const sql = SQL;
  await ensureTaxTables(sql);

  const rows = (await sql`
    select * from tax_rates where tenant_slug = ${tenantSlug} order by effective_from desc
  `) as any[];

  return rows.map(normalizeTaxRate);
}

export async function createTaxReturn(data: {
  tenantSlug: string;
  taxType: string;
  periodStart: string;
  periodEnd: string;
  notes?: string;
}): Promise<TaxReturn> {
  const sql = SQL;
  await ensureTaxTables(sql);

  const id = randomUUID();

  const transactions = (await sql`
    select * from tax_transactions
    where tenant_slug = ${data.tenantSlug}
      and transaction_date >= ${data.periodStart}
      and transaction_date <= ${data.periodEnd}
      and tax_return_id is null
  `) as any[];

  const totalCollected = transactions
    .filter(t => t.transaction_type === "vat_output" || t.transaction_type === "sales")
    .reduce((s, t) => s + Number(t.tax_amount), 0);
  const totalPaid = transactions
    .filter(t => t.transaction_type === "vat_input" || t.transaction_type === "purchase")
    .reduce((s, t) => s + Number(t.tax_amount), 0);
  const totalWithheld = transactions
    .filter(t => t.transaction_type === "wht_deducted")
    .reduce((s, t) => s + Number(t.tax_amount), 0);
  const netPayable = totalCollected - totalPaid - totalWithheld;

  const [row] = (await sql`
    insert into tax_returns (
      id, tenant_slug, tax_type, period_start, period_end,
      total_tax_collected, total_tax_paid, total_tax_withheld, net_tax_payable,
      status, notes
    ) values (
      ${id}, ${data.tenantSlug}, ${data.taxType}, ${data.periodStart}, ${data.periodEnd},
      ${totalCollected}, ${totalPaid}, ${totalWithheld}, ${netPayable},
      'draft', ${data.notes ?? null}
    )
    returning *
  `) as any[];

  await sql`
    update tax_transactions
    set tax_return_id = ${id}
    where tenant_slug = ${data.tenantSlug}
      and transaction_date >= ${data.periodStart}
      and transaction_date <= ${data.periodEnd}
      and tax_return_id is null
  `;

  return normalizeTaxReturn(row);
}

export async function listTaxReturns(tenantSlug: string): Promise<TaxReturn[]> {
  const sql = SQL;
  await ensureTaxTables(sql);

  const rows = (await sql`
    select * from tax_returns where tenant_slug = ${tenantSlug} order by period_start desc
  `) as any[];

  return rows.map(normalizeTaxReturn);
}

export async function fileTaxReturn(id: string, tenantSlug: string, reference: string): Promise<TaxReturn | null> {
  const sql = SQL;
  await ensureTaxTables(sql);

  const [row] = (await sql`
    update tax_returns
    set status = 'filed', filed_date = now(), reference = ${reference}, updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug}
    returning *
  `) as any[];

  return row ? normalizeTaxReturn(row) : null;
}

export async function markTaxReturnPaid(id: string, tenantSlug: string): Promise<TaxReturn | null> {
  const sql = SQL;
  await ensureTaxTables(sql);

  const [row] = (await sql`
    update tax_returns
    set status = 'paid', paid_date = now(), updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug}
    returning *
  `) as any[];

  return row ? normalizeTaxReturn(row) : null;
}

export async function listTaxTransactions(tenantSlug: string, limit = 50): Promise<TaxTransaction[]> {
  const sql = SQL;
  await ensureTaxTables(sql);

  const rows = (await sql`
    select * from tax_transactions
    where tenant_slug = ${tenantSlug}
    order by transaction_date desc, created_at desc
    limit ${limit}
  `) as any[];

  return rows.map(normalizeTaxTransaction);
}

export async function recordTaxTransaction(data: {
  tenantSlug: string;
  transactionType: string;
  sourceType: string;
  sourceId?: string;
  transactionDate: string;
  description: string;
  baseAmount: number;
  taxRate: number;
  taxAmount: number;
}): Promise<TaxTransaction> {
  const sql = SQL;
  await ensureTaxTables(sql);

  const id = randomUUID();
  const [row] = (await sql`
    insert into tax_transactions (
      id, tenant_slug, tax_return_id, transaction_type, source_type, source_id,
      transaction_date, description, base_amount, tax_rate, tax_amount
    ) values (
      ${id}, ${data.tenantSlug}, null, ${data.transactionType}, ${data.sourceType},
      ${data.sourceId ?? null}, ${data.transactionDate}, ${data.description},
      ${data.baseAmount}, ${data.taxRate}, ${data.taxAmount}
    )
    returning *
  `) as any[];

  return normalizeTaxTransaction(row);
}

function normalizeTaxRate(row: any): TaxRate {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    taxType: row.tax_type,
    name: row.name,
    rate: Number(row.rate),
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function normalizeTaxReturn(row: any): TaxReturn {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    taxType: row.tax_type,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    totalTaxCollected: Number(row.total_tax_collected),
    totalTaxPaid: Number(row.total_tax_paid),
    totalTaxWithheld: Number(row.total_tax_withheld),
    netTaxPayable: Number(row.net_tax_payable),
    status: row.status,
    filedDate: row.filed_date,
    paidDate: row.paid_date,
    reference: row.reference,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeTaxTransaction(row: any): TaxTransaction {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    taxReturnId: row.tax_return_id,
    transactionType: row.transaction_type,
    sourceType: row.source_type,
    sourceId: row.source_id,
    transactionDate: row.transaction_date,
    description: row.description,
    baseAmount: Number(row.base_amount),
    taxRate: Number(row.tax_rate),
    taxAmount: Number(row.tax_amount),
    createdAt: row.created_at,
  };
}
