/**
 * Localization packs — starting with Nigeria (NG).
 *
 * seedNigeriaPack() idempotently installs the statutory configuration a
 * Nigerian tenant needs:
 *   - tax_rates: VAT 7.5% output/input, common WHT rates
 *   - admin_statutory_profiles: annualized PAYE brackets with the
 *     Consolidated Relief Allowance, pension 8%/10%, NHF 2.5% (EE),
 *     NSITF 1% + ITF 1% + pension 10% (ER)
 *
 * Also provides the statutory report generators that aggregate
 * tax_transactions and payroll entries into remittance schedules.
 */

import { randomUUID } from "crypto";
import { db, sql as SQL } from "../sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { ensureTaxTables, recordTaxTransaction } from "./tax-management";
import { seedChartOfAccounts } from "../tenant/onboarding";

// ---------------------------------------------------------------------------
// Nigeria PAYE — annual brackets applied after the Consolidated Relief
// Allowance: max(₦200,000, 1% of gross) + 20% of gross.
// ---------------------------------------------------------------------------

export const NG_PAYE_BANDS = [
  { upTo: 300_000, rate: 7 },
  { upTo: 600_000, rate: 11 },
  { upTo: 1_100_000, rate: 15 },
  { upTo: 1_600_000, rate: 19 },
  { upTo: 3_200_000, rate: 21 },
  { upTo: null, rate: 24 },
] as const;

export const NG_CRA = {
  /** ₦200,000 or 1% of annual gross, whichever is higher. */
  fixedMin: 200_000,
  grossPercentFloor: 1,
  /** Plus 20% of annual gross. */
  grossPercent: 20,
} as const;

export const NG_TAX_RATES = [
  { taxType: "vat", name: "VAT — Output (sales)", rate: 7.5 },
  { taxType: "vat", name: "VAT — Input (purchases)", rate: 7.5 },
  { taxType: "wht", name: "WHT — Services (companies)", rate: 10 },
  { taxType: "wht", name: "WHT — Services (individuals)", rate: 5 },
  { taxType: "wht", name: "WHT — Goods & materials", rate: 5 },
  { taxType: "wht", name: "WHT — Rent, commission & dividends", rate: 10 },
] as const;

export const NG_EMPLOYEE_DEDUCTIONS = [
  { name: "NHF", type: "percent_of_gross", amount: 2.5 },
] as const;

export const NG_EMPLOYER_CONTRIBUTIONS = [
  { name: "Pension (employer)", type: "percent_of_gross", amount: 10 },
  { name: "NSITF", type: "percent_of_gross", amount: 1 },
  { name: "ITF", type: "percent_of_gross", amount: 1 },
] as const;

/** Annual PAYE on annual gross income (after CRA). Pure — used by tests. */
export function computeNigeriaPaye(annualGross: number): { cra: number; taxable: number; tax: number } {
  const cra =
    Math.max(NG_CRA.fixedMin, (annualGross * NG_CRA.grossPercentFloor) / 100) +
    (annualGross * NG_CRA.grossPercent) / 100;
  const taxable = Math.max(0, annualGross - cra);
  let tax = 0;
  let lower = 0;
  for (const band of NG_PAYE_BANDS) {
    const upper = band.upTo ?? Number.POSITIVE_INFINITY;
    if (taxable <= lower) break;
    tax += ((Math.min(taxable, upper) - lower) * band.rate) / 100;
    lower = upper;
  }
  return { cra, taxable, tax: Math.round(tax * 100) / 100 };
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

export function ensureStatutoryProfileColumns() {
  return ensureOnce("finance/localization:ensureColumns", async () => {
    const sql = SQL;
    await sql`alter table if exists admin_statutory_profiles
      add column if not exists paye_annualize boolean not null default false`;
    await sql`alter table if exists admin_statutory_profiles
      add column if not exists paye_relief jsonb`;
    await sql`alter table if exists admin_statutory_profiles
      add column if not exists employer_contributions jsonb not null default '[]'::jsonb`;
    await sql`alter table if exists bills add column if not exists wht_rate numeric(5,2)`;
    await sql`alter table if exists bills add column if not exists wht_amount numeric(18,2) not null default 0`;
    await sql`alter table if exists admin_payroll_entries
      add column if not exists employer_cost numeric(15,2) not null default 0`;
    await sql`alter table if exists admin_payroll_entries
      add column if not exists employer_breakdown jsonb not null default '[]'::jsonb`;
    await sql`alter table if exists admin_payroll_entries
      add column if not exists statutory_breakdown jsonb not null default '{}'::jsonb`;
  });
}

export interface NigeriaSeedResult {
  taxRatesInserted: number;
  taxRatesSkipped: number;
  statutoryProfile: "created" | "updated" | "unchanged";
  coaSeeded: { inserted: number; skipped: number };
}

export async function seedNigeriaPack(tenantSlug: string): Promise<NigeriaSeedResult> {
  await ensureTaxTables(SQL);
  await ensureStatutoryProfileColumns();

  // 1. Tax rates — idempotent on (type, name)
  let inserted = 0;
  let skipped = 0;
  for (const r of NG_TAX_RATES) {
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from tax_rates
       where tenant_slug = $1 and tax_type = $2 and name = $3`,
      [tenantSlug, r.taxType, r.name]
    );
    if (Number(rows[0]?.n ?? 0) > 0) {
      skipped++;
      continue;
    }
    await db.query(
      `insert into tax_rates (id, tenant_slug, tax_type, name, rate, effective_from, is_active)
       values ($1, $2, $3, $4, $5, '2000-01-01', true)`,
      [`tr-${randomUUID().slice(0, 8)}`, tenantSlug, r.taxType, r.name, r.rate]
    );
    inserted++;
  }

  // 2. Statutory payroll profile — upsert full NG config
  const profile = {
    country_code: "NG",
    tax_bands: NG_PAYE_BANDS,
    pension_employee_rate: 8,
    pension_employer_rate: 10,
    other_deductions: NG_EMPLOYEE_DEDUCTIONS,
    paye_annualize: true,
    paye_relief: NG_CRA,
    employer_contributions: NG_EMPLOYER_CONTRIBUTIONS,
  };
  const { rows: existing } = await db.query<{ id: string }>(
    `select id from admin_statutory_profiles where tenant_slug = $1`,
    [tenantSlug]
  );
  let statutoryProfile: NigeriaSeedResult["statutoryProfile"];
  if (!existing.length) {
    await db.query(
      `insert into admin_statutory_profiles (
         id, tenant_slug, country_code, tax_bands, pension_employee_rate,
         pension_employer_rate, other_deductions, paye_annualize, paye_relief,
         employer_contributions
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        `sp-${randomUUID().slice(0, 8)}`,
        tenantSlug,
        profile.country_code,
        JSON.stringify(profile.tax_bands),
        profile.pension_employee_rate,
        profile.pension_employer_rate,
        JSON.stringify(profile.other_deductions),
        profile.paye_annualize,
        JSON.stringify(profile.paye_relief),
        JSON.stringify(profile.employer_contributions),
      ]
    );
    statutoryProfile = "created";
  } else {
    await db.query(
      `update admin_statutory_profiles set
         country_code = $2, tax_bands = $3, pension_employee_rate = $4,
         pension_employer_rate = $5, other_deductions = $6, paye_annualize = $7,
         paye_relief = $8, employer_contributions = $9, updated_at = now()
       where tenant_slug = $1`,
      [
        tenantSlug,
        profile.country_code,
        JSON.stringify(profile.tax_bands),
        profile.pension_employee_rate,
        profile.pension_employer_rate,
        JSON.stringify(profile.other_deductions),
        profile.paye_annualize,
        JSON.stringify(profile.paye_relief),
        JSON.stringify(profile.employer_contributions),
      ]
    );
    statutoryProfile = "updated";
  }

  // 3. Statutory GL accounts (PAYE/Pension/NHF payables + the standard set)
  const coaSeeded = await seedChartOfAccounts(tenantSlug);

  return { taxRatesInserted: inserted, taxRatesSkipped: skipped, statutoryProfile, coaSeeded };
}

// ---------------------------------------------------------------------------
// Transaction recording helpers called from document flows
// ---------------------------------------------------------------------------

/** Record output VAT for a posted invoice. Idempotent per invoice. */
export async function recordInvoiceVat(data: {
  tenantSlug: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  date: string;
  baseAmount: number;
  taxAmount: number;
  vatRate?: number;
}) {
  if (data.taxAmount <= 0.005) return;
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from tax_transactions
     where tenant_slug = $1 and source_type = 'invoice' and source_id = $2
       and transaction_type = 'vat_output'`,
    [data.tenantSlug, data.invoiceId]
  );
  if (Number(rows[0]?.n ?? 0) > 0) return;
  await recordTaxTransaction({
    tenantSlug: data.tenantSlug,
    transactionType: "vat_output",
    sourceType: "invoice",
    sourceId: data.invoiceId,
    transactionDate: data.date,
    description: `VAT output — invoice ${data.invoiceNumber} (${data.customerName})`,
    baseAmount: data.baseAmount,
    taxRate: data.vatRate ?? 7.5,
    taxAmount: data.taxAmount,
  });
}

/** Record input VAT + WHT withheld for a posted bill. Idempotent per bill. */
export async function recordBillTaxes(data: {
  tenantSlug: string;
  billId: string;
  billNumber: string;
  vendorId: string;
  date: string;
  subtotal: number;
  vatAmount: number;
  whtAmount: number;
  whtRate?: number;
}) {
  await ensureTaxTables(SQL);
  if (data.vatAmount > 0.005) {
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from tax_transactions
       where tenant_slug = $1 and source_type = 'bill' and source_id = $2
         and transaction_type = 'vat_input'`,
      [data.tenantSlug, data.billId]
    );
    if (Number(rows[0]?.n ?? 0) === 0) {
      await recordTaxTransaction({
        tenantSlug: data.tenantSlug,
        transactionType: "vat_input",
        sourceType: "bill",
        sourceId: data.billId,
        transactionDate: data.date,
        description: `VAT input — bill ${data.billNumber}`,
        baseAmount: data.subtotal,
        taxRate: 7.5,
        taxAmount: data.vatAmount,
      });
    }
  }
  if (data.whtAmount > 0.005) {
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from tax_transactions
       where tenant_slug = $1 and source_type = 'bill' and source_id = $2
         and transaction_type = 'wht_deducted'`,
      [data.tenantSlug, data.billId]
    );
    if (Number(rows[0]?.n ?? 0) === 0) {
      await recordTaxTransaction({
        tenantSlug: data.tenantSlug,
        transactionType: "wht_deducted",
        sourceType: "bill",
        sourceId: data.billId,
        transactionDate: data.date,
        description: `WHT withheld — bill ${data.billNumber} (vendor ${data.vendorId})`,
        baseAmount: data.subtotal,
        taxRate: data.whtRate ?? 0,
        taxAmount: data.whtAmount,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Statutory reports
// ---------------------------------------------------------------------------

export interface VatSummary {
  period: { start: string; end: string };
  outputVat: { baseAmount: number; taxAmount: number; count: number };
  inputVat: { baseAmount: number; taxAmount: number; count: number };
  netPayable: number;
  monthly: Array<{ month: string; output: number; input: number; net: number }>;
}

export async function generateVatSummary(
  tenantSlug: string,
  start: string,
  end: string
): Promise<VatSummary> {
  await ensureTaxTables(SQL);
  const { rows } = await db.query<{
    transaction_type: string;
    base: string;
    tax: string;
    n: number;
    month: string;
  }>(
    `select transaction_type,
            sum(base_amount)::numeric(18,2) as base,
            sum(tax_amount)::numeric(18,2) as tax,
            count(*)::int as n,
            to_char(date_trunc('month', transaction_date), 'YYYY-MM') as month
     from tax_transactions
     where tenant_slug = $1 and transaction_date between $2 and $3
       and transaction_type in ('vat_output','vat_input')
     group by transaction_type, month`,
    [tenantSlug, start, end]
  );

  const output = { baseAmount: 0, taxAmount: 0, count: 0 };
  const input = { baseAmount: 0, taxAmount: 0, count: 0 };
  const months = new Map<string, { output: number; input: number }>();
  for (const r of rows) {
    const isOut = r.transaction_type === "vat_output";
    const bucket = isOut ? output : input;
    bucket.baseAmount += Number(r.base);
    bucket.taxAmount += Number(r.tax);
    bucket.count += r.n;
    const m = months.get(r.month) ?? { output: 0, input: 0 };
    if (isOut) m.output += Number(r.tax);
    else m.input += Number(r.tax);
    months.set(r.month, m);
  }
  return {
    period: { start, end },
    outputVat: output,
    inputVat: input,
    netPayable: output.taxAmount - input.taxAmount,
    monthly: [...months.entries()]
      .map(([month, v]) => ({ month, ...v, net: v.output - v.input }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  };
}

export interface WhtSchedule {
  period: { start: string; end: string };
  totalBase: number;
  totalWht: number;
  byMonth: Array<{ month: string; base: number; wht: number; count: number }>;
  byVendor: Array<{ vendorId: string; base: number; wht: number; count: number }>;
  lines: Array<{
    date: string;
    description: string;
    base: number;
    rate: number;
    wht: number;
  }>;
}

export async function generateWhtSchedule(
  tenantSlug: string,
  start: string,
  end: string
): Promise<WhtSchedule> {
  await ensureTaxTables(SQL);
  const { rows } = await db.query<{
    transaction_date: string;
    description: string;
    source_id: string | null;
    base_amount: string;
    tax_rate: string;
    tax_amount: string;
  }>(
    `select transaction_date, description, source_id, base_amount, tax_rate, tax_amount
     from tax_transactions
     where tenant_slug = $1 and transaction_date between $2 and $3
       and transaction_type = 'wht_deducted'
     order by transaction_date`,
    [tenantSlug, start, end]
  );

  const monthMap = new Map<string, { base: number; wht: number; count: number }>();
  const vendorMap = new Map<string, { base: number; wht: number; count: number }>();
  let totalBase = 0;
  let totalWht = 0;
  for (const r of rows) {
    const base = Number(r.base_amount);
    const wht = Number(r.tax_amount);
    totalBase += base;
    totalWht += wht;
    const month = String(r.transaction_date).slice(0, 7);
    const m = monthMap.get(month) ?? { base: 0, wht: 0, count: 0 };
    m.base += base; m.wht += wht; m.count++;
    monthMap.set(month, m);
    const vendor = r.source_id ?? "unknown";
    const v = vendorMap.get(vendor) ?? { base: 0, wht: 0, count: 0 };
    v.base += base; v.wht += wht; v.count++;
    vendorMap.set(vendor, v);
  }

  // Resolve vendor ids (bill ids) to names where possible
  const billIds = [...vendorMap.keys()].filter((k) => k !== "unknown");
  const vendorNames = new Map<string, string>();
  if (billIds.length) {
    const { rows: names } = await db.query<{ bill_id: string; vendor: string | null }>(
      `select b.id as bill_id, coalesce(v.name, b.vendor_id::text) as vendor
       from bills b left join vendors v on v.id::text = b.vendor_id::text and v.tenant_slug = b.tenant_slug
       where b.tenant_slug = $1 and b.id = any($2::uuid[])`,
      [tenantSlug, billIds]
    ).catch(() => ({ rows: [] as { bill_id: string; vendor: string | null }[] }));
    for (const n of names) if (n.vendor) vendorNames.set(n.bill_id, n.vendor);
  }

  return {
    period: { start, end },
    totalBase,
    totalWht,
    byMonth: [...monthMap.entries()]
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    byVendor: [...vendorMap.entries()].map(([id, v]) => ({
      vendorId: vendorNames.get(id) ?? id,
      ...v,
    })),
    lines: rows.map((r) => ({
      date: String(r.transaction_date).slice(0, 10),
      description: r.description,
      base: Number(r.base_amount),
      rate: Number(r.tax_rate),
      wht: Number(r.tax_amount),
    })),
  };
}

export interface PayeRemittance {
  periods: Array<{
    period: string;
    employees: number;
    gross: number;
    paye: number;
    pensionEmployee: number;
    pensionEmployer: number;
    nhf: number;
    otherStatutory: number;
    employerCost: number;
    net: number;
  }>;
  totals: {
    paye: number;
    pension: number;
    nhf: number;
    employerCost: number;
  };
}

/** PAYE/pension/NHF remittance schedule from payroll runs. */
export async function generatePayeRemittance(
  tenantSlug: string,
  periods?: number
): Promise<PayeRemittance> {
  await ensureStatutoryProfileColumns();
  const { rows } = await db.query<{
    period: string;
    employees: number;
    gross: string;
    paye: string;
    pension_ee: string;
    pension_er: string;
    nhf: string;
    other_stat: string;
    employer_cost: string;
    net: string;
  }>(
    `select r.period,
            count(*)::int as employees,
            sum(e.gross_pay)::numeric(15,2) as gross,
            sum(e.tax)::numeric(15,2) as paye,
            sum(e.pension)::numeric(15,2) as pension_ee,
            coalesce(sum((select coalesce(sum((b->>'amount')::numeric),0)
                          from jsonb_array_elements(e.employer_breakdown) b
                          where b->>'name' ilike '%pension%')),0)::numeric(15,2) as pension_er,
            coalesce(sum((e.statutory_breakdown->>'nhf')::numeric),0)::numeric(15,2) as nhf,
            coalesce(sum((e.statutory_breakdown->>'other')::numeric),0)::numeric(15,2) as other_stat,
            sum(e.employer_cost)::numeric(15,2) as employer_cost,
            sum(e.net_pay)::numeric(15,2) as net
     from admin_payroll_entries e
     join admin_payroll_runs r on r.id = e.run_id and r.tenant_slug = e.tenant_slug
     where e.tenant_slug = $1 and r.status <> 'cancelled'
     group by r.period
     order by r.period desc
     ${periods ? `limit ${Math.floor(periods)}` : ``}`,
    [tenantSlug]
  );

  const out = rows.map((r) => ({
    period: r.period,
    employees: r.employees,
    gross: Number(r.gross),
    paye: Number(r.paye),
    pensionEmployee: Number(r.pension_ee),
    pensionEmployer: Number(r.pension_er),
    nhf: Number(r.nhf),
    otherStatutory: Number(r.other_stat),
    employerCost: Number(r.employer_cost),
    net: Number(r.net),
  }));
  return {
    periods: out,
    totals: {
      paye: out.reduce((s, p) => s + p.paye, 0),
      pension: out.reduce((s, p) => s + p.pensionEmployee + p.pensionEmployer, 0),
      nhf: out.reduce((s, p) => s + p.nhf, 0),
      employerCost: out.reduce((s, p) => s + p.employerCost, 0),
    },
  };
}
