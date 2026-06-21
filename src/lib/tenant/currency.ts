import { db, sql as SQL, SqlClient } from "@/lib/sql-client";

export async function getTenantCurrency(tenantSlug: string, sql: SqlClient = SQL): Promise<string> {
  try {
    const rows = await sql`
      select settings->>'currency' as currency
      from tenants
      where slug = ${tenantSlug}
      limit 1
    `;
    const arr = rows as any[];
    return arr[0]?.currency || 'USD';
  } catch {
    return 'USD';
  }
}

export async function setTenantCurrency(tenantSlug: string, currency: string, sql: SqlClient = SQL): Promise<void> {
  await sql`
    update tenants
    set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('currency', ${currency}::text)
    where slug = ${tenantSlug}
  `;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  NGN: '₦',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
  INR: '₹',
  BRL: 'R$',
  ZAR: 'R',
  KES: 'KSh',
  GHS: '₵',
  NOK: 'kr',
  SEK: 'kr',
  DKK: 'kr',
  CHF: 'CHF',
  SGD: 'S$',
  HKD: 'HK$',
  CNY: '¥',
  MXN: 'MX$',
  AED: 'DH',
  SAR: '﷼',
};

export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode.toUpperCase()] || currencyCode.toUpperCase();
}
