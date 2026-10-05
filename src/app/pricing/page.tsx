import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav } from '@/components/marketing/site-nav';
import { SiteFooter } from '@/components/marketing/site-footer';

export const metadata: Metadata = {
  title: 'Pricing — Pisairtel ERP',
  description: 'Simple pricing for African SMEs. Start free, scale as your team grows.',
};

const tiers = [
  {
    name: 'Starter',
    price: 'Free',
    period: 'forever',
    tagline: 'For small teams getting organised.',
    features: [
      'Up to 5 users',
      'CRM + Finance basics',
      '1 workspace',
      'Standard reports',
      'Email support',
    ],
    cta: 'Start free',
    featured: false,
  },
  {
    name: 'Growth',
    price: '₦25,000',
    period: '/month',
    tagline: 'For businesses that run on automation.',
    features: [
      'Up to 25 users',
      'All modules: CRM, Finance, HR, Inventory, Projects',
      'Automation workflows & smart approvals',
      'Live P&L, balance sheet, cash flow',
      'Priority support',
    ],
    cta: 'Start free trial',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    tagline: 'For multi-branch and regulated teams.',
    features: [
      'Unlimited users & branches',
      'Custom roles & access control',
      'Dedicated success manager',
      'SLA-backed support',
      'Onboarding & data migration',
    ],
    cta: 'Talk to us',
    featured: false,
  },
];

export default function PricingPage() {
  return (
    <div className="bg-[#0B1120] min-h-screen overflow-x-hidden">
      <SiteNav />

      <section className="pt-[140px] pb-16 px-[6%] text-center">
        <div className="text-[11.5px] font-semibold tracking-[.1em] text-[#E8286E] mb-[14px]">PRICING</div>
        <h1 className="font-jakarta text-[clamp(34px,5vw,56px)] font-extrabold tracking-[-.02em] text-[#F8FAFC] leading-[1.15] mb-[18px]">
          Simple pricing,<br />serious automation.
        </h1>
        <p className="text-[15px] text-[#94A3B8] leading-[1.7] max-w-[560px] mx-auto">
          Start free. Upgrade when your team grows. Every plan includes the connected core — no per-module pricing games.
        </p>
      </section>

      <section className="px-[6%] pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1100px] mx-auto items-stretch">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`rounded-[16px] p-8 flex flex-col transition-all duration-300 hover:-translate-y-1 ${t.featured ? 'bg-[#1A2438] border-2 border-[rgba(227,30,36,.45)]' : 'bg-[#1A2438] border border-[rgba(255,255,255,0.07)]'}`}
              style={t.featured ? { boxShadow: '0 20px 50px rgba(227,30,36,.15)' } : undefined}
            >
              {t.featured && (
                <div className="self-start text-[10.5px] font-bold tracking-[.08em] text-[#E8286E] bg-[rgba(227,30,36,.12)] border border-[rgba(227,30,36,.3)] rounded-full px-3 py-[4px] mb-4">MOST POPULAR</div>
              )}
              <div className="font-jakarta text-[17px] font-bold text-[#F8FAFC] mb-[10px]">{t.name}</div>
              <div className="mb-[10px]">
                <span className="font-jakarta text-[34px] font-extrabold text-[#F8FAFC]">{t.price}</span>
                {t.period && <span className="text-[13px] text-[#64748B] ml-1">{t.period}</span>}
              </div>
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
                href={t.name === 'Enterprise' ? '/support' : '/signup'}
                className={`inline-flex items-center justify-center gap-2 px-6 py-[12px] rounded-[10px] font-jakarta text-sm font-bold transition-all hover:-translate-y-[1px] ${t.featured ? 'text-white' : 'text-[#F8FAFC] border border-[rgba(255,255,255,0.12)] hover:border-[#E31E24]'}`}
                style={t.featured ? { background: 'linear-gradient(135deg,#E31E24,#C0208A)', boxShadow: '0 4px 14px rgba(227,30,36,.35)' } : undefined}
              >
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
