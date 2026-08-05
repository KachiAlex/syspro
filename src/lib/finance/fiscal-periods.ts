import { randomUUID } from "crypto";
import { sql as SQL, SqlClient } from "../sql-client";

export interface FiscalPeriod {
  id: string;
  tenantSlug: string;
  name: string;
  fiscalYear: number;
  periodNumber: number;
  periodType: "month" | "quarter" | "year";
  startDate: string;
  endDate: string;
  status: "open" | "closed" | "locked";
  closedAt: string | null;
  closedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function ensureFiscalPeriodTables(sql: SqlClient = SQL) {
  await sql`
    create table if not exists fiscal_periods (
      id text primary key,
      tenant_slug text not null,
      name text not null,
      fiscal_year integer not null,
      period_number integer not null,
      period_type text not null check (period_type in ('month', 'quarter', 'year')),
      start_date date not null,
      end_date date not null,
      status text not null default 'open' check (status in ('open', 'closed', 'locked')),
      closed_at timestamptz,
      closed_by text,
      notes text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`create index if not exists fiscal_periods_tenant_idx on fiscal_periods (tenant_slug, fiscal_year)`;
  await sql`create index if not exists fiscal_periods_status_idx on fiscal_periods (tenant_slug, status)`;
}

export async function createFiscalPeriod(data: {
  tenantSlug: string;
  name: string;
  fiscalYear: number;
  periodNumber: number;
  periodType: string;
  startDate: string;
  endDate: string;
  notes?: string;
}): Promise<FiscalPeriod> {
  const sql = SQL;
  await ensureFiscalPeriodTables(sql);

  const id = randomUUID();
  const [row] = (await sql`
    insert into fiscal_periods (
      id, tenant_slug, name, fiscal_year, period_number, period_type,
      start_date, end_date, status, notes
    ) values (
      ${id}, ${data.tenantSlug}, ${data.name}, ${data.fiscalYear}, ${data.periodNumber},
      ${data.periodType}, ${data.startDate}, ${data.endDate}, 'open', ${data.notes ?? null}
    )
    returning *
  `) as any[];

  return normalizeFiscalPeriod(row);
}

export async function listFiscalPeriods(tenantSlug: string, fiscalYear?: number): Promise<FiscalPeriod[]> {
  const sql = SQL;
  await ensureFiscalPeriodTables(sql);

  const rows = fiscalYear
    ? (await sql`select * from fiscal_periods where tenant_slug = ${tenantSlug} and fiscal_year = ${fiscalYear} order by period_number`)
    : (await sql`select * from fiscal_periods where tenant_slug = ${tenantSlug} order by fiscal_year desc, period_number`);

  return (rows as any[]).map(normalizeFiscalPeriod);
}

export async function getFiscalPeriod(id: string, tenantSlug: string): Promise<FiscalPeriod | null> {
  const sql = SQL;
  await ensureFiscalPeriodTables(sql);

  const [row] = (await sql`
    select * from fiscal_periods where id = ${id} and tenant_slug = ${tenantSlug}
  `) as any[];

  return row ? normalizeFiscalPeriod(row) : null;
}

export async function closeFiscalPeriod(id: string, tenantSlug: string, closedBy: string, notes?: string): Promise<FiscalPeriod | null> {
  const sql = SQL;
  await ensureFiscalPeriodTables(sql);

  const [row] = (await sql`
    update fiscal_periods
    set status = 'closed', closed_at = now(), closed_by = ${closedBy},
        notes = coalesce(notes || chr(10), '') || coalesce(${notes ?? null}, ''),
        updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug} and status = 'open'
    returning *
  `) as any[];

  return row ? normalizeFiscalPeriod(row) : null;
}

export async function lockFiscalPeriod(id: string, tenantSlug: string): Promise<FiscalPeriod | null> {
  const sql = SQL;
  await ensureFiscalPeriodTables(sql);

  const [row] = (await sql`
    update fiscal_periods
    set status = 'locked', updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug} and status = 'closed'
    returning *
  `) as any[];

  return row ? normalizeFiscalPeriod(row) : null;
}

export async function reopenFiscalPeriod(id: string, tenantSlug: string): Promise<FiscalPeriod | null> {
  const sql = SQL;
  await ensureFiscalPeriodTables(sql);

  const [row] = (await sql`
    update fiscal_periods
    set status = 'open', closed_at = null, closed_by = null, updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug} and status != 'locked'
    returning *
  `) as any[];

  return row ? normalizeFiscalPeriod(row) : null;
}

export async function getCurrentPeriod(tenantSlug: string): Promise<FiscalPeriod | null> {
  const sql = SQL;
  await ensureFiscalPeriodTables(sql);

  const [row] = (await sql`
    select * from fiscal_periods
    where tenant_slug = ${tenantSlug}
      and status = 'open'
      and start_date <= current_date
      and end_date >= current_date
    order by start_date desc
    limit 1
  `) as any[];

  return row ? normalizeFiscalPeriod(row) : null;
}

export async function generateYearlyPeriods(tenantSlug: string, fiscalYear: number, periodType: "month" | "quarter"): Promise<FiscalPeriod[]> {
  const sql = SQL;
  await ensureFiscalPeriodTables(sql);

  const periods: FiscalPeriod[] = [];
  const count = periodType === "month" ? 12 : 4;

  for (let i = 0; i < count; i++) {
    const periodNumber = i + 1;
    const startDate = new Date(fiscalYear, i * (periodType === "month" ? 1 : 3), 1);
    const endDate = new Date(fiscalYear, i * (periodType === "month" ? 1 : 3) + (periodType === "month" ? 1 : 3), 0);

    const name = periodType === "month"
      ? startDate.toLocaleString("en-US", { month: "long" }) + " " + fiscalYear
      : `Q${periodNumber} FY${fiscalYear}`;

    const period = await createFiscalPeriod({
      tenantSlug,
      name,
      fiscalYear,
      periodNumber,
      periodType,
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
    });
    periods.push(period);
  }

  return periods;
}

function normalizeFiscalPeriod(row: any): FiscalPeriod {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    name: row.name,
    fiscalYear: row.fiscal_year,
    periodNumber: row.period_number,
    periodType: row.period_type,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    closedAt: row.closed_at,
    closedBy: row.closed_by,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
