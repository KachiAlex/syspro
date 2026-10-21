import { randomUUID } from "crypto";
import { db, sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";

// ---------------------------------------------------------------------------
// Tax engine (ERPNext: Item Tax Template, Sales/Purchase Taxes and Charges
// Template, Tax Rule, Tax Category, Tax Withholding, Shipping Rule).
// ---------------------------------------------------------------------------

export function ensureTaxTables() {
  return ensureOnce("finance/tax-engine:ensureTables", async () => {
    const sql = SQL;
    await sql`
      create table if not exists tax_templates (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        name text not null,
        direction text not null default 'sales' check (direction in ('sales','purchase','both')),
        lines jsonb not null default '[]'::jsonb,
        created_at timestamptz not null default now(),
        unique (tenant_slug, name)
      )`;
    await sql`
      create table if not exists item_tax_templates (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        item text not null,
        tax_template_id uuid references tax_templates (id) on delete cascade,
        created_at timestamptz not null default now(),
        unique (tenant_slug, item)
      )`;
    await sql`
      create table if not exists party_tax_categories (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        party_type text not null,
        party_id text not null,
        tax_category text not null,
        created_at timestamptz not null default now(),
        unique (tenant_slug, party_type, party_id)
      )`;
    await sql`
      create table if not exists tax_rules (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        name text not null,
        priority integer not null default 0,
        direction text not null default 'sales' check (direction in ('sales','purchase')),
        tax_category text,
        party_type text,
        party_id text,
        item text,
        min_amount numeric,
        max_amount numeric,
        valid_from date,
        valid_to date,
        tax_template_id uuid references tax_templates (id) on delete cascade,
        active boolean not null default true,
        created_at timestamptz not null default now()
      )`;
    await sql`create index if not exists tax_rules_idx on tax_rules (tenant_slug, direction, priority)`;

    await sql`
      create table if not exists tax_withholding_categories (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        name text not null,
        rates jsonb not null,
        account_code text not null default '2210',
        created_at timestamptz not null default now(),
        unique (tenant_slug, name)
      )`;
    await sql`
      create table if not exists tax_withholding_entries (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        category_id uuid not null references tax_withholding_categories (id) on delete cascade,
        party_type text not null,
        party_id text not null,
        document_type text not null,
        document_id text not null,
        fiscal_year integer not null,
        taxable_amount numeric not null,
        withheld_amount numeric not null,
        rate numeric not null,
        created_at timestamptz not null default now()
      )`;
    await sql`create index if not exists tds_entries_idx
      on tax_withholding_entries (tenant_slug, party_id, fiscal_year)`;

    await sql`
      create table if not exists shipping_rules (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        name text not null,
        min_value numeric,
        max_value numeric,
        min_weight numeric,
        max_weight numeric,
        charge_type text not null default 'flat' check (charge_type in ('flat','percent')),
        charge_value numeric not null,
        account_code text,
        active boolean not null default true,
        created_at timestamptz not null default now(),
        unique (tenant_slug, name)
      )`;
  });
}

// ─── Templates ──────────────────────────────────────────────────────────────

export interface TaxTemplateLine {
  description?: string;
  rate: number;            // percent
  accountCode?: string;    // tax account (e.g. VAT output 2205)
}

export async function upsertTaxTemplate(input: {
  tenantSlug: string; name: string; direction?: "sales" | "purchase" | "both";
  lines: TaxTemplateLine[];
}) {
  await ensureTaxTables();
  const [row] = (await SQL`
    insert into tax_templates (tenant_slug, name, direction, lines)
    values (${input.tenantSlug}, ${input.name.trim()}, ${input.direction ?? "sales"}, ${JSON.stringify(input.lines)})
    on conflict (tenant_slug, name) do update set direction = excluded.direction, lines = excluded.lines
    returning *
  `) as any[];
  return row;
}

export async function listTaxTemplates(tenantSlug: string, direction?: string) {
  await ensureTaxTables();
  return (await SQL`
    select * from tax_templates
    where tenant_slug = ${tenantSlug}
      ${direction ? SQL`and direction in (${direction}, 'both')` : SQL``}
    order by name
  `) as any[];
}

export async function setItemTaxTemplate(input: {
  tenantSlug: string; item: string; taxTemplateId: string;
}) {
  await ensureTaxTables();
  await SQL`
    insert into item_tax_templates (tenant_slug, item, tax_template_id)
    values (${input.tenantSlug}, ${input.item}, ${input.taxTemplateId})
    on conflict (tenant_slug, item) do update set tax_template_id = excluded.tax_template_id`;
}

export async function setPartyTaxCategory(input: {
  tenantSlug: string; partyType: "customer" | "vendor"; partyId: string; taxCategory: string;
}) {
  await ensureTaxTables();
  await SQL`
    insert into party_tax_categories (tenant_slug, party_type, party_id, tax_category)
    values (${input.tenantSlug}, ${input.partyType}, ${input.partyId}, ${input.taxCategory})
    on conflict (tenant_slug, party_type, party_id) do update set tax_category = excluded.tax_category`;
}

// ─── Tax Rules ──────────────────────────────────────────────────────────────

export async function upsertTaxRule(input: {
  tenantSlug: string; id?: string; name: string; priority?: number;
  direction: "sales" | "purchase"; taxCategory?: string;
  partyType?: string; partyId?: string; item?: string;
  minAmount?: number; maxAmount?: number;
  validFrom?: string; validTo?: string; taxTemplateId: string;
  active?: boolean;
}) {
  await ensureTaxTables();
  const [row] = (await SQL`
    insert into tax_rules (id, tenant_slug, name, priority, direction, tax_category, party_type, party_id, item,
                           min_amount, max_amount, valid_from, valid_to, tax_template_id, active)
    values (${input.id ?? randomUUID()}, ${input.tenantSlug}, ${input.name.trim()}, ${input.priority ?? 0},
            ${input.direction}, ${input.taxCategory ?? null}, ${input.partyType ?? null}, ${input.partyId ?? null},
            ${input.item ?? null}, ${input.minAmount ?? null}, ${input.maxAmount ?? null},
            ${input.validFrom ?? null}, ${input.validTo ?? null}, ${input.taxTemplateId}, ${input.active ?? true})
    returning *
  `) as any[];
  return row;
}

/**
 * Picks the best tax template for a transaction: item-level mapping first,
 * then highest-priority matching tax rule (category → party → item → amount
 * band → validity window), else null (default rates apply).
 */
export async function resolveTaxTemplate(input: {
  tenantSlug: string; direction: "sales" | "purchase";
  partyType?: string; partyId?: string;
  item?: string; amount?: number; date?: string;
}): Promise<{ templateId: string; name: string; lines: TaxTemplateLine[]; via: string } | null> {
  await ensureTaxTables();
  const sql = SQL;

  if (input.item) {
    const [map] = (await sql`
      select t.id, t.name, t.lines from item_tax_templates m
      join tax_templates t on t.id = m.tax_template_id
      where m.tenant_slug = ${input.tenantSlug} and m.item = ${input.item}
        and t.direction in (${input.direction}, 'both')
    `) as any[];
    if (map) return { templateId: map.id, name: map.name, lines: parseLines(map.lines), via: "item" };
  }

  const category = input.partyType && input.partyId
    ? ((await sql`
        select tax_category from party_tax_categories
        where tenant_slug = ${input.tenantSlug} and party_type = ${input.partyType} and party_id = ${input.partyId}
      `) as any[])[0]?.tax_category ?? null
    : null;

  const rules = (await sql`
    select r.*, t.name template_name, t.lines from tax_rules r
    join tax_templates t on t.id = r.tax_template_id
    where r.tenant_slug = ${input.tenantSlug} and r.direction = ${input.direction} and r.active
      and (r.tax_category is null or r.tax_category = ${category})
      and (r.party_type is null or r.party_type = ${input.partyType ?? null})
      and (r.party_id is null or r.party_id = ${input.partyId ?? null})
      and (r.item is null or r.item = ${input.item ?? null})
      and (r.min_amount is null or ${input.amount ?? 0} >= r.min_amount)
      and (r.max_amount is null or ${input.amount ?? 0} <= r.max_amount)
      and (r.valid_from is null or r.valid_from <= ${input.date ?? new Date().toISOString().slice(0, 10)})
      and (r.valid_to is null or r.valid_to >= ${input.date ?? new Date().toISOString().slice(0, 10)})
    order by r.priority desc, r.created_at
    limit 1
  `) as any[];
  const rule = rules[0];
  return rule
    ? { templateId: rule.tax_template_id, name: rule.template_name, lines: parseLines(rule.lines), via: `rule:${rule.name}` }
    : null;
}

function parseLines(v: any): TaxTemplateLine[] {
  const arr = typeof v === "string" ? JSON.parse(v) : v;
  return Array.isArray(arr) ? arr : [];
}

/** Applies template lines to an amount → tax rows (amount per line). */
export function computeTaxLines(amount: number, lines: TaxTemplateLine[]) {
  return lines.map((l) => ({
    description: l.description ?? "Tax",
    rate: l.rate,
    accountCode: l.accountCode,
    amount: Math.round(amount * l.rate) / 100,
  }));
}

// ─── Tax Withholding (TDS/WHT with cumulative thresholds) ──────────────────

export async function upsertWithholdingCategory(input: {
  tenantSlug: string; name: string; accountCode?: string;
  /** e.g. [{rate:5, singleThreshold:0, cumulativeThreshold:0}] */
  rates: Array<{ rate: number; singleThreshold?: number; cumulativeThreshold?: number }>;
}) {
  await ensureTaxTables();
  const [row] = (await SQL`
    insert into tax_withholding_categories (tenant_slug, name, rates, account_code)
    values (${input.tenantSlug}, ${input.name.trim()}, ${JSON.stringify(input.rates)}, ${input.accountCode ?? "2210"})
    on conflict (tenant_slug, name) do update set rates = excluded.rates, account_code = excluded.account_code
    returning *
  `) as any[];
  return row;
}

export async function listWithholdingCategories(tenantSlug: string) {
  await ensureTaxTables();
  return (await SQL`
    select * from tax_withholding_categories where tenant_slug = ${tenantSlug} order by name
  `) as any[];
}

/**
 * Computes withholding for a document, honoring single-invoice and cumulative
 * (per fiscal year) thresholds. Records an entry so subsequent documents see
 * the running total.
 */
export async function computeAndRecordWithholding(input: {
  tenantSlug: string; categoryId: string;
  partyType: "vendor" | "customer"; partyId: string;
  documentType: "bill" | "invoice"; documentId: string;
  taxableAmount: number; fiscalYear?: number;
}) {
  await ensureTaxTables();
  const [cat] = (await SQL`
    select * from tax_withholding_categories where id = ${input.categoryId} and tenant_slug = ${input.tenantSlug}
  `) as any[];
  if (!cat) throw new Error("Withholding category not found");
  const rates = parseLines(cat.rates) as any[];
  if (!rates.length) return { withheld: 0, rate: 0 };

  const fy = input.fiscalYear ?? new Date().getUTCFullYear();
  const [{ cumulative }] = (await db.query(
    `select coalesce(sum(taxable_amount),0) cumulative from tax_withholding_entries
     where tenant_slug = $1 and category_id = $2 and party_id = $3 and fiscal_year = $4`,
    [input.tenantSlug, input.categoryId, input.partyId, fy],
  )).rows as any[];

  const rate = rates.find((r) =>
    input.taxableAmount >= (r.singleThreshold ?? 0) &&
    Number(cumulative) + input.taxableAmount > (r.cumulativeThreshold ?? 0),
  ) ?? rates[0];
  const withheld = Math.round(input.taxableAmount * Number(rate.rate)) / 100;

  await SQL`
    insert into tax_withholding_entries (tenant_slug, category_id, party_type, party_id, document_type, document_id, fiscal_year, taxable_amount, withheld_amount, rate)
    values (${input.tenantSlug}, ${input.categoryId}, ${input.partyType}, ${input.partyId},
            ${input.documentType}, ${input.documentId}, ${fy}, ${input.taxableAmount}, ${withheld}, ${Number(rate.rate)})`;
  return { withheld, rate: Number(rate.rate), cumulativeBefore: Number(cumulative), accountCode: cat.account_code };
}

// ─── Shipping Rules ─────────────────────────────────────────────────────────

export async function upsertShippingRule(input: {
  tenantSlug: string; name: string;
  minValue?: number; maxValue?: number; minWeight?: number; maxWeight?: number;
  chargeType: "flat" | "percent"; chargeValue: number; accountCode?: string; active?: boolean;
}) {
  await ensureTaxTables();
  const [row] = (await SQL`
    insert into shipping_rules (tenant_slug, name, min_value, max_value, min_weight, max_weight, charge_type, charge_value, account_code, active)
    values (${input.tenantSlug}, ${input.name.trim()}, ${input.minValue ?? null}, ${input.maxValue ?? null},
            ${input.minWeight ?? null}, ${input.maxWeight ?? null}, ${input.chargeType}, ${input.chargeValue},
            ${input.accountCode ?? null}, ${input.active ?? true})
    on conflict (tenant_slug, name) do update set
      min_value = excluded.min_value, max_value = excluded.max_value,
      min_weight = excluded.min_weight, max_weight = excluded.max_weight,
      charge_type = excluded.charge_type, charge_value = excluded.charge_value,
      account_code = excluded.account_code, active = excluded.active
    returning *
  `) as any[];
  return row;
}

export async function resolveShippingCharge(input: {
  tenantSlug: string; orderValue: number; weight?: number;
}) {
  await ensureTaxTables();
  const rules = (await SQL`
    select * from shipping_rules
    where tenant_slug = ${input.tenantSlug} and active
      and (min_value is null or ${input.orderValue} >= min_value)
      and (max_value is null or ${input.orderValue} <= max_value)
      and (min_weight is null or ${input.weight ?? 0} >= min_weight)
      and (max_weight is null or ${input.weight ?? 0} <= max_weight)
    order by charge_value desc limit 1
  `) as any[];
  const r = rules[0];
  if (!r) return { charge: 0, rule: null };
  const charge = r.charge_type === "percent"
    ? Math.round(input.orderValue * Number(r.charge_value)) / 100
    : Number(r.charge_value);
  return { charge: Math.round(charge * 100) / 100, rule: r.name, accountCode: r.account_code };
}
