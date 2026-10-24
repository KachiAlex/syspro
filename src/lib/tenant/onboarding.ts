/**
 * Tenant Onboarding
 *
 * Guided setup for new tenant admins. The persisted row in
 * tenant_onboarding_state stores only UI metadata (skipped steps, dismissal,
 * completion timestamp). Each step's completion is recomputed live from real
 * tenant data on every read — configuration done outside the wizard counts
 * automatically.
 *
 * The wizard guides; it does not gate. Optional steps can be skipped and any
 * step can be reset. Seeds (chart of accounts, fiscal year) are idempotent.
 */

import { db } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { randomUUID } from "crypto";

export type StepStatus = "pending" | "complete" | "skipped";

export type OnboardingStepId =
  | "profile"
  | "branches"
  | "fiscal-periods"
  | "chart-of-accounts"
  | "warehouses"
  | "currencies"
  | "localization"
  | "team"
  | "finance-policies"
  | "opening-data"
  | "go-live";

export interface OnboardingStepDef {
  id: OnboardingStepId;
  title: string;
  description: string;
  required: boolean;
  /** Deep link to the full configuration surface for advanced changes. */
  link: string;
}

export interface OnboardingStepState extends OnboardingStepDef {
  status: StepStatus;
  detail: string;
  skipped: boolean;
  /** Migration file needed before this step can be evaluated. */
  schemaPending?: string;
  /** The validation check itself errored (non-schema). */
  checkError?: boolean;
}

export interface OnboardingState {
  tenantSlug: string;
  steps: OnboardingStepState[];
  /** First incomplete required step id. */
  currentStep: OnboardingStepId | null;
  dismissed: boolean;
  completedAt: string | null;
  /** Distinct migrations/objects missing from the DB schema, if any. */
  schemaPending: string[];
  progress: { done: number; total: number; requiredDone: number; requiredTotal: number; percent: number };
}

export const ONBOARDING_STEPS: OnboardingStepDef[] = [
  {
    id: "profile",
    title: "Company profile",
    description:
      "Set your company name, industry, region, base currency and timezone. These drive reporting, document formatting and posting defaults.",
    required: true,
    link: "/tenant-admin/settings",
  },
  {
    id: "branches",
    title: "Branches & locations",
    description:
      "Create at least one active branch. Branches tag every GL line, invoice, expense and stock movement so reports can be filtered per location.",
    required: true,
    link: "/tenant-admin/org-structure",
  },
  {
    id: "fiscal-periods",
    title: "Fiscal year & periods",
    description:
      "Generate the accounting calendar. Journal entries can only post into an open period that covers their date.",
    required: true,
    link: "/tenant-admin/finance",
  },
  {
    id: "chart-of-accounts",
    title: "Chart of accounts",
    description:
      "Seed the standard general-ledger accounts (assets, liabilities, equity, income, expenses) or build your own structure.",
    required: true,
    link: "/tenant-admin/accounting",
  },
  {
    id: "warehouses",
    title: "Warehouses",
    description:
      "Create at least one stock location and link it to a branch for per-warehouse balances and transfers.",
    required: false,
    link: "/tenant-admin/inventory",
  },
  {
    id: "currencies",
    title: "Currencies & exchange rates",
    description:
      "Confirm the base currency. If you transact in other currencies, register exchange rates so settlements can compute realized gain/loss.",
    required: false,
    link: "/tenant-admin/finance",
  },
  {
    id: "localization",
    title: "Localization & statutory setup",
    description:
      "Apply your country's tax and payroll defaults. The Nigeria pack installs VAT 7.5%, WHT rates, PAYE brackets with consolidated relief, pension, NHF and employer contributions.",
    required: false,
    link: "/tenant-admin/finance",
  },
  {
    id: "team",
    title: "Users & roles",
    description:
      "Invite additional administrators or employees and assign module access. The creating admin alone still counts as configured if you work solo.",
    required: false,
    link: "/tenant-admin/users",
  },
  {
    id: "finance-policies",
    title: "Finance policies",
    description:
      "Optional: payment terms, customer credit limits/holds, dunning levels and budget enforcement modes.",
    required: false,
    link: "/tenant-admin/finance",
  },
  {
    id: "opening-data",
    title: "Opening data",
    description:
      "Optional: add customers, vendors and products (or post opening balances) before going live.",
    required: false,
    link: "/tenant-admin/finance",
  },
  {
    id: "go-live",
    title: "Review & go live",
    description:
      "Confirm the required foundations are in place and mark setup complete. You can revisit any step afterwards.",
    required: true,
    link: "/tenant-admin",
  },
];

// ---------------------------------------------------------------------------
// Table ensure (defensive; canonical DDL is the migration)
// ---------------------------------------------------------------------------

export function ensureOnboardingTable() {
  return ensureOnce("tenant/onboarding:ensureTable", async () => {
    await db.sql`
      create table if not exists tenant_onboarding_state (
        tenant_slug text primary key,
        steps jsonb not null default '{}'::jsonb,
        current_step text,
        dismissed boolean not null default false,
        completed_at timestamptz,
        updated_at timestamptz not null default now()
      )
    `;
  });
}

// ---------------------------------------------------------------------------
// Live validators — each returns { complete, detail }
// ---------------------------------------------------------------------------

type ValidatorResult = {
  complete: boolean;
  detail: string;
  /** Set when the check couldn't run because the DB schema is behind. */
  schemaPending?: string;
  /** Set when the check failed for a non-schema reason (surfaced, not hidden). */
  checkError?: boolean;
};
type Validator = (tenantSlug: string) => Promise<ValidatorResult>;

/**
 * Which migration file provides each table the validators read. Used to give
 * admins a precise action ("apply 20261102_tenant_branches.sql") instead of a
 * vague failure.
 */
const TABLE_MIGRATION: Record<string, string> = {
  tenants: "core schema",
  tenant_admins: "core schema",
  admin_employees: "hr schema",
  fiscal_periods: "20261016_gl_consolidation.sql",
  chart_of_accounts: "20261016_gl_consolidation.sql",
  journal_entries: "20261016_gl_consolidation.sql",
  tenant_branches: "20261102_tenant_branches.sql",
  tax_rates: "tax-management schema",
  admin_statutory_profiles: "hr schema",
  inventory_warehouses: "20261103_inventory_warehouses.sql",
  inventory_stock_balances: "20261103_inventory_warehouses.sql",
  inventory_products: "inventory schema",
  vendors: "vendors schema",
  payment_terms: "20261101_finance_extensions.sql",
  finance_customers: "20261101_finance_extensions.sql",
  exchange_rates: "20261101_finance_extensions.sql",
};

export function classifyValidatorError(err: unknown, fallback: string): ValidatorResult {
  const code = (err as { code?: string })?.code;
  const message = err instanceof Error ? err.message : String(err);
  if (code === "42P01" || code === "42703") {
    // undefined_table / undefined_column — a pending migration, name it exactly
    const rel = /relation "([^"]+)"/.exec(message)?.[1] ?? /column "([^"]+)"/.exec(message)?.[1];
    const migration = rel ? TABLE_MIGRATION[rel] : undefined;
    return {
      complete: false,
      detail: migration
        ? `Database schema is behind — table "${rel}" is missing. Apply migration ${migration}.`
        : `Database schema is behind — "${rel ?? "unknown object"}" is missing. Run pending migrations.`,
      schemaPending: migration ?? rel ?? "unknown",
    };
  }
  // Anything else (permissions, connectivity, bad data) is a real failure — surface it.
  return { complete: false, detail: `Check failed: ${message || fallback}`, checkError: true };
}

async function safe(fn: () => Promise<ValidatorResult>, fallback: string): Promise<ValidatorResult> {
  try {
    return await fn();
  } catch (err) {
    return classifyValidatorError(err, fallback);
  }
}

async function tableCount(sql: string, params: unknown[]): Promise<number> {
  const { rows } = await db.query<{ n: number }>(sql, params);
  return Number(rows[0]?.n ?? 0);
}

const VALIDATORS: Record<OnboardingStepId, Validator> = {
  "profile": (tenantSlug) =>
    safe(async () => {
      const { rows } = await db.query<{ name: string | null; currency: string | null }>(
        `select name, coalesce(settings->>'baseCurrency', settings->>'currency') as currency
         from tenants where slug = $1`,
        [tenantSlug]
      );
      const t = rows[0];
      if (!t) return { complete: false, detail: "Tenant record not found." };
      const missing: string[] = [];
      if (!t.name?.trim()) missing.push("company name");
      if (!t.currency?.trim()) missing.push("base currency");
      return missing.length
        ? { complete: false, detail: `Missing: ${missing.join(", ")}.` }
        : { complete: true, detail: `${t.name} · ${t.currency}` };
    }, "Could not read tenant profile."),

  "branches": (tenantSlug) =>
    safe(async () => {
      const n = await tableCount(
        `select count(*)::int as n from tenant_branches where tenant_slug = $1 and coalesce(status,'active') <> 'inactive'`,
        [tenantSlug]
      );
      return n > 0
        ? { complete: true, detail: `${n} active branch${n === 1 ? "" : "es"}.` }
        : { complete: false, detail: "No active branch found — create one below or in Org structure." };
    }, "tenant_branches is not available yet."),

  "fiscal-periods": (tenantSlug) =>
    safe(async () => {
      const { rows } = await db.query<{ n: number; fy: number | null }>(
        `select count(*)::int as n, max(fiscal_year) as fy
         from fiscal_periods
         where tenant_slug = $1 and current_date between start_date and end_date`,
        [tenantSlug]
      );
      const covering = Number(rows[0]?.n ?? 0);
      if (covering > 0) {
        return { complete: true, detail: `FY${rows[0].fy} covers today.` };
      }
      const total = await tableCount(
        `select count(*)::int as n from fiscal_periods where tenant_slug = $1`,
        [tenantSlug]
      );
      return total > 0
        ? { complete: false, detail: `${total} period(s) exist but none covers today — generate the current fiscal year.` }
        : { complete: false, detail: "No fiscal periods — postings are blocked until you generate a year." };
    }, "fiscal_periods is not available yet."),

  "chart-of-accounts": (tenantSlug) =>
    safe(async () => {
      const n = await tableCount(
        `select count(*)::int as n from chart_of_accounts where tenant_slug = $1 or tenant_slug is null`,
        [tenantSlug]
      );
      return n >= 5
        ? { complete: true, detail: `${n} accounts available.` }
        : { complete: false, detail: `${n} account(s) — seed the standard chart below.` };
    }, "chart_of_accounts is not available yet."),

  "warehouses": (tenantSlug) =>
    safe(async () => {
      const n = await tableCount(
        `select count(*)::int as n from inventory_warehouses where tenant_slug = $1 and coalesce(status,'active') <> 'inactive'`,
        [tenantSlug]
      );
      return n > 0
        ? { complete: true, detail: `${n} warehouse${n === 1 ? "" : "s"} configured.` }
        : { complete: false, detail: "No warehouse — create one (e.g. Main Store) or skip if you don't track stock." };
    }, "inventory_warehouses is not available yet."),

  "currencies": (tenantSlug) =>
    safe(async () => {
      const { rows } = await db.query<{ currency: string | null }>(
        `select coalesce(settings->>'baseCurrency', settings->>'currency') as currency
         from tenants where slug = $1`,
        [tenantSlug]
      );
      const base = rows[0]?.currency;
      if (!base) return { complete: false, detail: "Set a base currency in the company profile step." };
      const rates = await tableCount(
        `select count(*)::int as n from exchange_rates where tenant_slug = $1`,
        [tenantSlug]
      );
      return {
        complete: true,
        detail: rates > 0 ? `Base ${base} · ${rates} exchange rate(s).` : `Base currency ${base}.`,
      };
    }, "Currency settings are not available yet."),

  "localization": (tenantSlug) =>
    safe(async () => {
      const rates = await tableCount(
        `select count(*)::int as n from tax_rates where tenant_slug = $1`,
        [tenantSlug]
      );
      const profile = await tableCount(
        `select count(*)::int as n from admin_statutory_profiles where tenant_slug = $1`,
        [tenantSlug]
      );
      const configured = rates > 0 || profile > 0;
      return configured
        ? { complete: true, detail: `${rates} tax rate(s)${profile ? " + payroll statutory profile" : ""}.` }
        : { complete: false, detail: "No tax or payroll statutory config — apply a country pack below." };
    }, "Tax/localization tables are not available yet."),

  "team": (tenantSlug) =>
    safe(async () => {
      const admins = await tableCount(
        `select count(*)::int as n from tenant_admins where tenant_slug = $1`,
        [tenantSlug]
      );
      const employees = await tableCount(
        `select count(*)::int as n from admin_employees where tenant_slug = $1`,
        [tenantSlug]
      );
      const total = admins + employees;
      return total > 1
        ? { complete: true, detail: `${total} admin/employee record(s).` }
        : { complete: false, detail: "Only one user — invite teammates or skip if you work solo." };
    }, "User tables are not available yet."),

  "finance-policies": (tenantSlug) =>
    safe(async () => {
      const terms = await tableCount(
        `select count(*)::int as n from payment_terms where tenant_slug = $1`,
        [tenantSlug]
      );
      const credit = await tableCount(
        `select count(*)::int as n from finance_customers where tenant_slug = $1 and coalesce(credit_limit,0) > 0`,
        [tenantSlug]
      );
      const configured = terms + credit;
      return configured > 0
        ? { complete: true, detail: `${terms} payment term(s), ${credit} credit limit(s).` }
        : { complete: false, detail: "No payment terms or credit limits yet — optional, can be skipped." };
    }, "Finance policy tables are not available yet."),

  "opening-data": (tenantSlug) =>
    safe(async () => {
      const customers = await tableCount(
        `select count(*)::int as n from finance_customers where tenant_slug = $1`,
        [tenantSlug]
      );
      const vendors = await tableCount(
        `select count(*)::int as n from vendors where tenant_slug = $1`,
        [tenantSlug]
      );
      const products = await tableCount(
        `select count(*)::int as n from inventory_products where tenant_slug = $1`,
        [tenantSlug]
      );
      const total = customers + vendors + products;
      return total > 0
        ? { complete: true, detail: `${customers} customer(s), ${vendors} vendor(s), ${products} product(s).` }
        : { complete: false, detail: "No master data yet — add it in the app or skip this step." };
    }, "Master-data tables are not available yet."),

  "go-live": async (tenantSlug) => {
    // Complete when every other required step validates; detail reports stragglers.
    const missing: string[] = [];
    const blocked: string[] = [];
    let schemaPending: string | undefined;
    for (const step of ONBOARDING_STEPS) {
      if (!step.required || step.id === "go-live") continue;
      const r = await VALIDATORS[step.id](tenantSlug);
      if (r.complete) continue;
      if (r.schemaPending) {
        blocked.push(step.title);
        schemaPending = r.schemaPending;
      } else {
        missing.push(step.title);
      }
    }
    if (blocked.length) {
      return {
        complete: false,
        detail: `Cannot verify: ${blocked.join(", ")} — pending migrations.${
          missing.length ? ` Still required: ${missing.join(", ")}.` : ""
        }`,
        schemaPending,
      };
    }
    return missing.length
      ? { complete: false, detail: `Still required: ${missing.join(", ")}.` }
      : { complete: true, detail: "All required foundations are in place." };
  },
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type StoredStepMeta = { skipped?: boolean; at?: string };
type StoredSteps = Partial<Record<OnboardingStepId, StoredStepMeta>>;

async function readStateRow(tenantSlug: string): Promise<{
  steps: StoredSteps;
  dismissed: boolean;
  completed_at: string | null;
}> {
  await ensureOnboardingTable();
  const { rows } = await db.query<{ steps: StoredSteps | null; dismissed: boolean; completed_at: Date | null }>(
    `select steps, dismissed, completed_at from tenant_onboarding_state where tenant_slug = $1`,
    [tenantSlug]
  );
  if (!rows.length) {
    await db.query(
      `insert into tenant_onboarding_state (tenant_slug, steps) values ($1, '{}'::jsonb) on conflict do nothing`,
      [tenantSlug]
    );
    return { steps: {}, dismissed: false, completed_at: null };
  }
  return {
    steps: rows[0].steps ?? {},
    dismissed: rows[0].dismissed,
    completed_at: rows[0].completed_at ? rows[0].completed_at.toISOString() : null,
  };
}

async function patchState(tenantSlug: string, patch: {
  stepId?: OnboardingStepId;
  meta?: StoredStepMeta | null;
  currentStep?: string | null;
  dismissed?: boolean;
  completedAt?: string | null;
}) {
  await ensureOnboardingTable();
  await db.query(
    `insert into tenant_onboarding_state (tenant_slug) values ($1) on conflict do nothing`,
    [tenantSlug]
  );
  if (patch.stepId !== undefined) {
    if (patch.meta === null) {
      await db.query(
        `update tenant_onboarding_state set steps = steps - $2, updated_at = now() where tenant_slug = $1`,
        [tenantSlug, patch.stepId]
      );
    } else {
      await db.query(
        `update tenant_onboarding_state
         set steps = jsonb_set(coalesce(steps,'{}'::jsonb), array[$2], coalesce(steps->$2,'{}'::jsonb) || $3::jsonb),
             updated_at = now()
         where tenant_slug = $1`,
        [tenantSlug, patch.stepId, JSON.stringify(patch.meta)]
      );
    }
  }
  if (patch.dismissed !== undefined) {
    await db.query(
      `update tenant_onboarding_state set dismissed = $2, updated_at = now() where tenant_slug = $1`,
      [tenantSlug, patch.dismissed]
    );
  }
  if (patch.currentStep !== undefined) {
    await db.query(
      `update tenant_onboarding_state set current_step = $2, updated_at = now() where tenant_slug = $1`,
      [tenantSlug, patch.currentStep]
    );
  }
  if (patch.completedAt !== undefined) {
    await db.query(
      `update tenant_onboarding_state set completed_at = $2, updated_at = now() where tenant_slug = $1`,
      [tenantSlug, patch.completedAt]
    );
  }
}

export async function getOnboardingState(tenantSlug: string): Promise<OnboardingState> {
  const stored = await readStateRow(tenantSlug);
  const steps: OnboardingStepState[] = [];
  const schemaPending = new Set<string>();
  for (const def of ONBOARDING_STEPS) {
    const live = await VALIDATORS[def.id](tenantSlug);
    const meta = stored.steps[def.id];
    const status: StepStatus = live.complete ? "complete" : meta?.skipped ? "skipped" : "pending";
    if (live.schemaPending) schemaPending.add(live.schemaPending);
    steps.push({
      ...def,
      status,
      detail: live.detail,
      skipped: Boolean(meta?.skipped),
      schemaPending: live.schemaPending,
      checkError: live.checkError,
    });
  }
  const required = steps.filter((s) => s.required);
  const requiredDone = required.filter((s) => s.status === "complete").length;
  const done = steps.filter((s) => s.status !== "pending").length;
  const currentStep =
    (steps.find((s) => s.required && s.status === "pending")?.id as OnboardingStepId | undefined) ?? null;
  return {
    tenantSlug,
    steps,
    currentStep,
    dismissed: stored.dismissed,
    completedAt: stored.completed_at,
    schemaPending: [...schemaPending],
    progress: {
      done,
      total: steps.length,
      requiredDone,
      requiredTotal: required.length,
      percent: Math.round((done / steps.length) * 100),
    },
  };
}

export async function skipStep(tenantSlug: string, stepId: OnboardingStepId, skip = true) {
  const def = ONBOARDING_STEPS.find((s) => s.id === stepId);
  if (!def) throw new Error(`Unknown onboarding step: ${stepId}`);
  if (def.required && skip) throw new Error(`Step "${def.title}" is required and cannot be skipped.`);
  await patchState(tenantSlug, {
    stepId,
    meta: skip ? { skipped: true, at: new Date().toISOString() } : null,
  });
}

export async function setDismissed(tenantSlug: string, dismissed: boolean) {
  await patchState(tenantSlug, { dismissed });
}

export async function setCurrentStep(tenantSlug: string, stepId: OnboardingStepId | null) {
  await patchState(tenantSlug, { currentStep: stepId });
}

export async function markCompleted(tenantSlug: string): Promise<OnboardingState> {
  const state = await getOnboardingState(tenantSlug);
  const incompleteRequired = state.steps.filter((s) => s.required && s.status !== "complete");
  if (incompleteRequired.length) {
    throw new Error(
      `Cannot complete setup — required steps pending: ${incompleteRequired.map((s) => s.title).join(", ")}`
    );
  }
  await patchState(tenantSlug, { completedAt: new Date().toISOString() });
  return getOnboardingState(tenantSlug);
}

export async function resetOnboarding(tenantSlug: string) {
  await ensureOnboardingTable();
  await db.query(
    `update tenant_onboarding_state
     set steps = '{}'::jsonb, current_step = null, dismissed = false, completed_at = null, updated_at = now()
     where tenant_slug = $1`,
    [tenantSlug]
  );
}

// ---------------------------------------------------------------------------
// Mutations the wizard itself performs
// ---------------------------------------------------------------------------

export interface ProfileInput {
  name?: string;
  industry?: string;
  region?: string;
  baseCurrency?: string;
  timezone?: string;
}

export async function updateTenantProfile(tenantSlug: string, input: ProfileInput) {
  const currency = input.baseCurrency?.trim().toUpperCase() || null;
  await db.query(
    `update tenants
     set name = coalesce($2, name),
         industry = coalesce($3, industry),
         region = coalesce($4, region),
         settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
           'currency', coalesce($5, settings->>'currency'),
           'baseCurrency', coalesce($5, settings->>'baseCurrency'),
           'timezone', coalesce($6, settings->>'timezone')
         ),
         "updatedAt" = now()
     where slug = $1`,
    [
      tenantSlug,
      input.name?.trim() || null,
      input.industry?.trim() || null,
      input.region?.trim() || null,
      currency,
      input.timezone?.trim() || null,
    ]
  );
}

const COA_SEED: Array<{ code: string; name: string; type: string }> = [
  { code: "1040", name: "Petty Cash / Imprest", type: "asset" },
  { code: "1100", name: "Bank Account", type: "asset" },
  { code: "1110", name: "Cash", type: "asset" },
  { code: "1120", name: "Corporate Card", type: "liability" },
  { code: "1200", name: "Accounts Receivable", type: "asset" },
  { code: "1210", name: "Staff Advances", type: "asset" },
  { code: "1250", name: "Intercompany Receivable", type: "asset" },
  { code: "1300", name: "Work In Progress", type: "asset" },
  { code: "1400", name: "Finished Goods Inventory", type: "asset" },
  { code: "1500", name: "Raw Materials Inventory", type: "asset" },
  { code: "1600", name: "Prepaid Expenses", type: "asset" },
  { code: "2100", name: "Accounts Payable", type: "liability" },
  { code: "2150", name: "Intercompany Payable", type: "liability" },
  { code: "2200", name: "VAT Input Tax", type: "asset" },
  { code: "2205", name: "VAT Output Tax", type: "liability" },
  { code: "2210", name: "Withholding Tax Payable", type: "liability" },
  { code: "2300", name: "Payroll Payable", type: "liability" },
  { code: "2310", name: "Payroll Deductions Payable", type: "liability" },
  { code: "2320", name: "PAYE Tax Payable", type: "liability" },
  { code: "2330", name: "Pension Contributions Payable", type: "liability" },
  { code: "2340", name: "NHF Contributions Payable", type: "liability" },
  { code: "3100", name: "Retained Earnings", type: "equity" },
  { code: "4000", name: "Sales Revenue", type: "revenue" },
  { code: "4100", name: "Service Revenue", type: "revenue" },
  { code: "4500", name: "Interest Income", type: "revenue" },
  { code: "4600", name: "Dunning & Fee Income", type: "revenue" },
  { code: "4900", name: "Sales Returns & Allowances", type: "revenue" },
  { code: "5000", name: "Cost of Goods Sold", type: "expense" },
  { code: "6100", name: "General Expenses", type: "expense" },
  { code: "6200", name: "Material Variance", type: "expense" },
  { code: "6300", name: "Salaries & Wages", type: "expense" },
  { code: "6810", name: "Bank Charges & Fees", type: "expense" },
  { code: "7700", name: "Realized Exchange Gain/Loss", type: "expense" },
];

/**
 * Idempotently seed the standard chart of accounts for a tenant. Codes that
 * already resolve for the tenant (tenant-scoped or global) are skipped.
 */
export async function seedChartOfAccounts(tenantSlug: string): Promise<{ inserted: number; skipped: number }> {
  const { rows: currencyRows } = await db.query<{ currency: string | null }>(
    `select coalesce(settings->>'baseCurrency', settings->>'currency') as currency from tenants where slug = $1`,
    [tenantSlug]
  );
  const currency = currencyRows[0]?.currency || "NGN";
  let inserted = 0;
  let skipped = 0;
  for (const a of COA_SEED) {
    const { rows: exists } = await db.query<{ n: number }>(
      `select count(*)::int as n from chart_of_accounts
       where coalesce(code, account_code) = $1 and (tenant_slug = $2 or tenant_slug is null)`,
      [a.code, tenantSlug]
    );
    if (Number(exists[0]?.n ?? 0) > 0) {
      skipped++;
      continue;
    }
    const accountType = a.type === "revenue" ? "INCOME" : a.type.toUpperCase();
    const { rowCount } = await db.query(
      `insert into chart_of_accounts (
         id, tenant_slug, code, name, type,
         account_code, account_name, account_type,
         currency, is_active, is_system_account, created_at, updated_at
       ) values ($1, $2, $3, $4, $5, $3, $4, $6, $7, true, false, now(), now())
       on conflict do nothing`,
      [randomUUID(), tenantSlug, a.code, a.name, a.type, accountType, currency]
    );
    if (rowCount > 0) inserted++;
    else skipped++;
  }
  return { inserted, skipped };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Idempotently create 12 monthly fiscal periods for the given fiscal year.
 */
export async function seedFiscalYear(
  tenantSlug: string,
  fiscalYear: number
): Promise<{ inserted: number; skipped: number }> {
  if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
    throw new Error("fiscalYear must be a valid year (2000–2100).");
  }
  let inserted = 0;
  let skipped = 0;
  for (let m = 0; m < 12; m++) {
    const start = `${fiscalYear}-${String(m + 1).padStart(2, "0")}-01`;
    // Last day of month via date arithmetic in SQL keeps this timezone-safe.
    const endExpr = `($3::date + interval '1 month' - interval '1 day')::date`;
    const { rows: exists } = await db.query<{ n: number }>(
      `select count(*)::int as n from fiscal_periods
       where tenant_slug = $1 and fiscal_year = $2 and period_number = $3`,
      [tenantSlug, fiscalYear, m + 1]
    );
    if (Number(exists[0]?.n ?? 0) > 0) {
      skipped++;
      continue;
    }
    await db.query(
      `insert into fiscal_periods (
         id, tenant_slug, fiscal_year, period_number, period_name, name,
         period_type, start_date, end_date, status, allow_posting, created_at, updated_at
       ) values (
         gen_random_uuid(), $1, $2, $4, $5, $5, 'month', $3, ${endExpr}, 'open', true, now(), now()
       )`,
      [tenantSlug, fiscalYear, start, m + 1, `${MONTH_NAMES[m]} ${fiscalYear}`]
    );
    inserted++;
  }
  return { inserted, skipped };
}
