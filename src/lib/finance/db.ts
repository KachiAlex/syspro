import { getSql } from "@/lib/db";

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

  await Promise.all([
    sql`create index if not exists finance_accounts_tenant_idx on finance_accounts (tenant_slug)`,
    sql`create index if not exists finance_schedules_tenant_idx on finance_schedules (tenant_slug, document_type)`,
    sql`create index if not exists finance_expense_categories_tenant_idx on finance_expense_categories (tenant_slug)`,
    sql`create index if not exists finance_trend_points_tenant_idx on finance_trend_points (tenant_slug, timeframe)`,
  ]);
}
