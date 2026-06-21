'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

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
  QAR: '﷼',
  KWD: 'KD',
  BHD: 'BD',
  OMR: '﷼',
  JOD: 'JD',
  LBP: 'L£',
  PKR: '₨',
  BDT: '৳',
  LKR: 'Rs',
  NPR: '₨',
  MMK: 'K',
  IDR: 'Rp',
  THB: '฿',
  MYR: 'RM',
  PHP: '₱',
  VND: '₫',
  KRW: '₩',
  TWD: 'NT$',
  NZD: 'NZ$',
  FJD: 'FJ$',
  PGK: 'K',
  SBD: 'SI$',
  VUV: 'VT',
  WST: 'WS$',
  TOP: 'T$',
  XOF: 'CFA',
  XAF: 'FCFA',
  EGP: 'E£',
  MAD: 'DH',
  TZS: 'TSh',
  UGX: 'USh',
  ARS: '$',
  CLP: '$',
  COP: '$',
  PEN: 'S/',
  UYU: '$U',
  PLN: 'zł',
  CZK: 'Kč',
  HUF: 'Ft',
  RON: 'lei',
  BGN: 'лв',
  HRK: 'kn',
  RUB: '₽',
  TRY: '₺',
  ILS: '₪',
};

export function getCurrencySymbol(code?: string): string {
  if (!code) return '$';
  return CURRENCY_SYMBOLS[code.toUpperCase()] || code.toUpperCase();
}

export function formatCurrency(amount: number, currencyCode?: string): string {
  const symbol = getCurrencySymbol(currencyCode);
  return `${symbol}${amount.toLocaleString()}`;
}

export function useCurrency() {
  const { tenantSlug } = useTenantContext();
  const [currency, setCurrency] = useState<string>('USD');
  const [loading, setLoading] = useState(true);

  const symbol = getCurrencySymbol(currency);

  const format = useCallback(
    (amount: number) => formatCurrency(amount, currency),
    [currency]
  );

  useEffect(() => {
    if (!tenantSlug) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/tenant/settings?tenantSlug=${encodeURIComponent(tenantSlug)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const settings = data.settings as Array<{ id: string; value: any }> | undefined;
        const found = settings?.find((s) => s.id === 'currency');
        if (found?.value) setCurrency(String(found.value));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [tenantSlug]);

  return { currency, symbol, format, loading };
}
