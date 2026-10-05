import type { Metadata } from 'next';
import { SiteNav } from '@/components/marketing/site-nav';
import { SiteFooter } from '@/components/marketing/site-footer';
import { PricingCards } from '@/components/marketing/pricing-cards';
import { getPricingPlans } from '@/lib/pricing/plans';

export const metadata: Metadata = {
  title: 'Pricing — Pisairtel ERP',
  description: 'Simple pricing for African SMEs. Start free, scale as your team grows.',
};

// Plans are edited live by the superadmin — always render fresh data.
export const dynamic = 'force-dynamic';

const faqs = [
  {
    q: 'Is there a free trial?',
    a: 'Every paid plan starts with a 14-day free trial — no card required. When it ends you can keep going on the Free plan; your data stays put.',
  },
  {
    q: 'What happens when I hit my user limit?',
    a: 'Nothing breaks. We notify you, and you can upgrade to the next tier or add seats at ₦1,500/user/month without moving to Enterprise.',
  },
  {
    q: 'How do I pay?',
    a: 'Card via Paystack or Flutterwave, or bank transfer for annual plans. Prices are in Nigerian Naira and exclude VAT where applicable.',
  },
  {
    q: 'Can I change or cancel my plan?',
    a: 'Anytime. Upgrades apply immediately and we prorate the difference. Downgrades take effect at the next billing cycle.',
  },
  {
    q: 'Is my data locked in?',
    a: 'No. You can export all of your data — customers, invoices, staff records — at any time, on any plan, including Free.',
  },
];

export default async function PricingPage() {
  const plans = await getPricingPlans();

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
        <PricingCards plans={plans} />
      </section>

      <section className="px-[6%] pb-24">
        <div className="max-w-[760px] mx-auto">
          <h2 className="font-jakarta text-[26px] font-extrabold tracking-[-.02em] text-[#F8FAFC] text-center mb-10">
            Questions, answered.
          </h2>
          <div className="space-y-4">
            {faqs.map((f) => (
              <div key={f.q} className="bg-[#1A2438] border border-[rgba(255,255,255,0.07)] rounded-[14px] p-6">
                <h3 className="font-jakarta text-[15px] font-bold text-[#F8FAFC] mb-2">{f.q}</h3>
                <p className="text-[13.5px] text-[#94A3B8] leading-[1.7]">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
