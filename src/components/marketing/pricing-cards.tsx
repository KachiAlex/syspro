'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PricingPlan } from '@/lib/pricing/plans';

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '₦',
  USD: '$',
  EUR: '€',
  GBP: '£',
  KES: 'KSh',
  GHS: '₵',
  ZAR: 'R',
};

function formatMoney(amount: number, currency: string) {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${amount.toLocaleString()}`;
}

function Price({ plan, annual }: { plan: PricingPlan; annual: boolean }) {
  if (plan.price_label) {
    return (
      <>
        <span className="font-jakarta text-[34px] font-extrabold text-[#F8FAFC]">{plan.price_label}</span>
        {plan.period_label && <span className="text-[13px] text-[#64748B] ml-1">{plan.period_label}</span>}
      </>
    );
  }
  const amount = annual ? plan.price_annual ?? (plan.price_monthly ?? 0) * 10 : plan.price_monthly ?? 0;
  return (
    <>
      <span className="font-jakarta text-[34px] font-extrabold text-[#F8FAFC]">
        {formatMoney(amount, plan.currency)}
      </span>
      <span className="text-[13px] text-[#64748B] ml-1">{annual ? '/year' : plan.period_label}</span>
    </>
  );
}

export function PricingCards({ plans }: { plans: PricingPlan[] }) {
  const [annual, setAnnual] = useState(false);
  const hasPrices = plans.some((p) => !p.price_label && (p.price_monthly ?? 0) > 0);

  return (
    <div>
      {hasPrices && (
        <div className="flex items-center justify-center gap-3 mb-10">
          <span className={`text-[13px] font-semibold ${!annual ? 'text-[#F8FAFC]' : 'text-[#64748B]'}`}>Monthly</span>
          <button
            type="button"
            role="switch"
            aria-checked={annual}
            aria-label="Toggle annual billing"
            onClick={() => setAnnual(!annual)}
            className={`relative w-[46px] h-[24px] rounded-full transition-colors ${annual ? 'bg-[#E31E24]' : 'bg-[#334155]'}`}
          >
            <span
              className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-all ${annual ? 'left-[25px]' : 'left-[3px]'}`}
            />
          </button>
          <span className={`text-[13px] font-semibold ${annual ? 'text-[#F8FAFC]' : 'text-[#64748B]'}`}>
            Annual
            <span className="ml-2 text-[10.5px] font-bold text-[#10B981] bg-[rgba(16,185,129,.12)] border border-[rgba(16,185,129,.3)] rounded-full px-2 py-[2px]">
              2 months free
            </span>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-[1280px] mx-auto items-stretch">
        {plans.map((t) => (
          <div
            key={t.key}
            className={`rounded-[16px] p-7 flex flex-col transition-all duration-300 hover:-translate-y-1 ${t.is_featured ? 'bg-[#1A2438] border-2 border-[rgba(227,30,36,.45)]' : 'bg-[#1A2438] border border-[rgba(255,255,255,0.07)]'}`}
            style={t.is_featured ? { boxShadow: '0 20px 50px rgba(227,30,36,.15)' } : undefined}
          >
            {t.is_featured && (
              <div className="self-start text-[10.5px] font-bold tracking-[.08em] text-[#E8286E] bg-[rgba(227,30,36,.12)] border border-[rgba(227,30,36,.3)] rounded-full px-3 py-[4px] mb-4">
                MOST POPULAR
              </div>
            )}
            <div className="font-jakarta text-[17px] font-bold text-[#F8FAFC] mb-[10px]">{t.name}</div>
            <div className="mb-[10px]">
              <Price plan={t} annual={annual} />
            </div>
            {annual && !t.price_label && (t.price_monthly ?? 0) > 0 && (
              <div className="text-[11.5px] text-[#64748B] -mt-[6px] mb-[10px]">
                {formatMoney(Math.round(((t.price_annual ?? (t.price_monthly ?? 0) * 10) / 12)), t.currency)}/mo billed annually
              </div>
            )}
            <p className="text-[13px] text-[#94A3B8] leading-[1.6] mb-[22px]">{t.tagline}</p>
            <ul className="space-y-[10px] mb-[28px] flex-1">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-[10px] text-[13px] text-[#94A3B8]">
                  <svg className="mt-[2px] flex-shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5"><polyline points="20,6 9,17 4,12" /></svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={t.cta_href || '/signup'}
              className={`inline-flex items-center justify-center gap-2 px-6 py-[12px] rounded-[10px] font-jakarta text-sm font-bold transition-all hover:-translate-y-[1px] ${t.is_featured ? 'text-white' : 'text-[#F8FAFC] border border-[rgba(255,255,255,0.12)] hover:border-[#E31E24]'}`}
              style={t.is_featured ? { background: 'linear-gradient(135deg,#E31E24,#C0208A)', boxShadow: '0 4px 14px rgba(227,30,36,.35)' } : undefined}
            >
              {t.cta_label}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
