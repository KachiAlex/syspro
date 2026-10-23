// Tenant-configurable posting account map (key -> account code).
// Business code resolves semantic keys ("pos_tender_cash", "grni", ...)
// instead of hardcoding account codes, so tenants can remap postings
// without code changes. Falls back to the GL_ACCOUNTS defaults.
import { db } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { GL_ACCOUNTS } from "./gl";

export const POSTING_KEYS = {
  cash_in_hand: GL_ACCOUNTS.CASH,
  bank: GL_ACCOUNTS.BANK,
  accounts_receivable: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE,
  accounts_payable: GL_ACCOUNTS.ACCOUNTS_PAYABLE,
  sales_income: GL_ACCOUNTS.SALES_REVENUE,
  cost_of_goods_sold: GL_ACCOUNTS.COGS,
  inventory_asset: GL_ACCOUNTS.RAW_MATERIALS,
  goods_received_not_invoiced: GL_ACCOUNTS.GRNI,
  vat_input: GL_ACCOUNTS.VAT_INPUT,
  vat_output: GL_ACCOUNTS.VAT_OUTPUT,
  loyalty_points_liability: GL_ACCOUNTS.LOYALTY_LIABILITY,
  loyalty_discount_expense: GL_ACCOUNTS.LOYALTY_EXPENSE,
  bank_charges: GL_ACCOUNTS.BANK_CHARGES,
  pos_tender_cash: GL_ACCOUNTS.CASH,
  pos_tender_pos: GL_ACCOUNTS.BANK,
  pos_tender_bank_transfer: GL_ACCOUNTS.BANK,
  pos_tender_mobile_money: GL_ACCOUNTS.BANK,
  pos_tender_store_credit: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE,
} as const;

export type PostingKey = keyof typeof POSTING_KEYS;

async function ensurePostingSettingsTables() {
  await ensureOnce("finance/posting-settings", async () => {
    await db.query(`
      create table if not exists finance_posting_settings (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        setting_key text not null,
        account_code text not null,
        updated_at timestamptz not null default now(),
        unique (tenant_slug, setting_key)
      )
    `);
    await db.query(
      `create index if not exists finance_posting_settings_tenant on finance_posting_settings (tenant_slug)`
    );
  });
}

/** Resolve a semantic posting key to an account code for this tenant. */
export async function resolvePostingAccount(
  tenantSlug: string,
  key: PostingKey
): Promise<string> {
  await ensurePostingSettingsTables();
  const rows = (await db.query<any>(
    `select account_code from finance_posting_settings where tenant_slug = $1 and setting_key = $2`,
    [tenantSlug, key]
  )).rows;
  const configured = rows[0]?.account_code;
  return configured || POSTING_KEYS[key];
}

/** All keys with their effective account (tenant override or default). */
export async function listPostingSettings(tenantSlug: string) {
  await ensurePostingSettingsTables();
  const rows = (await db.query<any>(
    `select setting_key, account_code from finance_posting_settings where tenant_slug = $1`,
    [tenantSlug]
  )).rows;
  const overrides = new Map(rows.map((r: any) => [r.setting_key, r.account_code]));
  return Object.entries(POSTING_KEYS).map(([key, defaultCode]) => ({
    key,
    accountCode: overrides.get(key) ?? defaultCode,
    isDefault: !overrides.has(key),
  }));
}

/**
 * Fail-fast preflight (Venditium checkout pattern): for each key, if the
 * tenant configured an override, verify the account actually exists in
 * chart_of_accounts — a bad override must abort the transaction instead of
 * silently auto-creating a junk account. Default fallbacks are always valid
 * (postGLEntry auto-provisions them).
 */
export async function assertPostingAccountsConfigured(
  tenantSlug: string,
  keys: PostingKey[]
): Promise<void> {
  await ensurePostingSettingsTables();
  const rows = (await db.query<any>(
    `select setting_key, account_code from finance_posting_settings
     where tenant_slug = $1 and setting_key = any($2)`,
    [tenantSlug, keys]
  )).rows;
  if (!rows.length) return; // all defaults — always provisioned on demand
  const codes = rows.map((r: any) => r.account_code);
  const existing = (await db.query<any>(
    `select coalesce(code, account_code) as code from chart_of_accounts
     where coalesce(code, account_code) = any($1)
       and (tenant_slug = $2 or tenant_slug is null)`,
    [codes, tenantSlug]
  )).rows;
  const found = new Set(existing.map((r: any) => r.code));
  const missing = rows
    .filter((r: any) => !found.has(r.account_code))
    .map((r: any) => `${r.setting_key} → ${r.account_code}`);
  if (missing.length) {
    throw new Error(`Posting accounts not configured: ${missing.join(", ")}`);
  }
}

export async function setPostingAccount(
  tenantSlug: string,
  key: string,
  accountCode: string
) {
  if (!(key in POSTING_KEYS)) {
    throw new Error(`Unknown posting key: ${key}. Valid: ${Object.keys(POSTING_KEYS).join(", ")}`);
  }
  await ensurePostingSettingsTables();
  await db.query(
    `insert into finance_posting_settings (tenant_slug, setting_key, account_code)
     values ($1, $2, $3)
     on conflict (tenant_slug, setting_key)
     do update set account_code = excluded.account_code, updated_at = now()`,
    [tenantSlug, key, accountCode]
  );
  return { key, accountCode };
}
