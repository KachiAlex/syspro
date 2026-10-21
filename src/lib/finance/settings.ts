import { db } from "../sql-client";

/**
 * ERPNext "Accounts Settings" — a single tenant-scoped settings document the
 * admin edits once; posting paths consult it at decision points.
 */
export interface FinanceSettings {
  tenantSlug: string;
  /** Postings dated on/before this date are rejected even in open periods. */
  accountsFrozenUntil: string | null;
  /** 'block' throws on credit-limit breach, 'warn' posts but flags, 'off' skips. */
  creditCheckMode: "block" | "warn" | "off";
  /** Run period-end FX revaluation automatically when closing a period. */
  autoExchangeRevaluation: boolean;
  /** Default payment terms in days applied to new invoices without terms. */
  defaultPaymentTermsDays: number;
  updatedAt: string;
}

const DEFAULTS = {
  accountsFrozenUntil: null as string | null,
  creditCheckMode: "block" as const,
  autoExchangeRevaluation: false,
  defaultPaymentTermsDays: 30,
};

async function ensureTable() {
  await db.query(`
    create table if not exists finance_settings (
      tenant_slug text primary key,
      accounts_frozen_until date,
      credit_check_mode text not null default 'block',
      auto_exchange_revaluation boolean not null default false,
      default_payment_terms_days integer not null default 30,
      updated_at timestamptz not null default now()
    )`);
}

export async function getFinanceSettings(tenantSlug: string): Promise<FinanceSettings> {
  await ensureTable();
  const { rows } = await db.query(
    `select * from finance_settings where tenant_slug = $1`, [tenantSlug],
  );
  const r = (rows as any[])[0];
  return {
    tenantSlug,
    accountsFrozenUntil: r?.accounts_frozen_until
      ? new Date(r.accounts_frozen_until).toISOString().slice(0, 10)
      : DEFAULTS.accountsFrozenUntil,
    creditCheckMode: r?.credit_check_mode ?? DEFAULTS.creditCheckMode,
    autoExchangeRevaluation: r?.auto_exchange_revaluation ?? DEFAULTS.autoExchangeRevaluation,
    defaultPaymentTermsDays: Number(r?.default_payment_terms_days ?? DEFAULTS.defaultPaymentTermsDays),
    updatedAt: r?.updated_at ?? null,
  };
}

export async function updateFinanceSettings(
  tenantSlug: string,
  updates: Partial<Omit<FinanceSettings, "tenantSlug" | "updatedAt">>,
): Promise<FinanceSettings> {
  await ensureTable();
  if (updates.creditCheckMode && !["block", "warn", "off"].includes(updates.creditCheckMode)) {
    throw new Error("creditCheckMode must be 'block', 'warn' or 'off'");
  }
  await db.query(
    `insert into finance_settings (tenant_slug, accounts_frozen_until, credit_check_mode,
                                   auto_exchange_revaluation, default_payment_terms_days)
     values ($1, $2, coalesce($3, 'block'), coalesce($4, false), coalesce($5, 30))
     on conflict (tenant_slug) do update set
       accounts_frozen_until = case when $6 then $2 else finance_settings.accounts_frozen_until end,
       credit_check_mode = coalesce($3, finance_settings.credit_check_mode),
       auto_exchange_revaluation = coalesce($4, finance_settings.auto_exchange_revaluation),
       default_payment_terms_days = coalesce($5, finance_settings.default_payment_terms_days),
       updated_at = now()`,
    [
      tenantSlug,
      updates.accountsFrozenUntil ?? null,
      updates.creditCheckMode ?? null,
      updates.autoExchangeRevaluation ?? null,
      updates.defaultPaymentTermsDays ?? null,
      // $6 distinguishes "not provided" from an explicit null (unfreeze).
      "accountsFrozenUntil" in updates,
    ],
  );
  return getFinanceSettings(tenantSlug);
}
