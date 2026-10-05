import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav } from '@/components/marketing/site-nav';
import { SiteFooter } from '@/components/marketing/site-footer';

export const metadata: Metadata = {
  title: 'How it works — Pisairtel ERP',
  description: 'Every action is a trigger, not a dead end. See how Pisairtel ERP runs the routine so you only touch the exceptions.',
};

const steps = [
  {
    num: '01',
    title: 'Deal won in CRM',
    desc: 'Invoice drafts, project creates, inventory reserves — simultaneously, without anyone clicking anything.',
    detail: 'When your sales rep marks a deal as won, the system drafts the invoice, spins up the delivery project, and reserves the stock. Your team sees the result, not the busywork.',
  },
  {
    num: '02',
    title: 'Expense submitted',
    desc: 'RBAC routes it to the right approver. Amount threshold determines the escalation path automatically.',
    detail: 'An employee submits an expense and the system already knows who needs to approve it — based on amount, department, and role. Small amounts auto-approve; large ones escalate.',
  },
  {
    num: '03',
    title: 'Approval granted',
    desc: 'Bill generates. Payment queues. Budget actuals post. GL records. Reports refresh. All at once.',
    detail: 'One approval fans out to every system that cares: the bill is created, the payment is queued, budgets and the general ledger are updated, and every report reflects it immediately.',
  },
];

const principles = [
  {
    title: 'Zero re-keying',
    desc: 'Data entered once flows everywhere it needs to go. No exports, no spreadsheets, no copy-paste between tools.',
  },
  {
    title: 'Exceptions, not routine',
    desc: 'The system handles the standard path. You only get pulled in when something genuinely needs a decision.',
  },
  {
    title: 'Everything auditable',
    desc: 'Every automatic action is logged with who triggered it, what ran, and when — so automation never means losing control.',
  },
];

export default function HowItWorksPage() {
  return (
    <div className="bg-[#0B1120] min-h-screen overflow-x-hidden">
      <SiteNav />

      <section className="pt-[140px] pb-16 px-[6%] text-center">
        <div className="text-[11.5px] font-semibold tracking-[.1em] text-[#F59E0B] mb-[14px]">THE PRINCIPLE</div>
        <h1 className="font-jakarta text-[clamp(34px,5vw,56px)] font-extrabold tracking-[-.02em] text-[#F8FAFC] leading-[1.15] mb-[18px]">
          Every action is a trigger,<br />not a dead end.
        </h1>
        <p className="text-[15px] text-[#94A3B8] leading-[1.7] max-w-[620px] mx-auto">
          Most SME software forces you to be your own accountant, approver, and analyst. Pisairtel ERP&apos;s automation layer removes that burden. The system runs the routine. You only touch the exceptions.
        </p>
      </section>

      <section className="px-[6%] pb-16">
        <div className="max-w-[760px] mx-auto">
          {steps.map((s) => (
            <div key={s.num} className="flex gap-[22px] text-left mb-4 bg-[#1A2438] border border-[rgba(255,255,255,0.07)] rounded-[14px] p-[26px_28px] items-start transition-colors hover:border-[rgba(227,30,36,.3)]">
              <div className="font-jakarta text-xs font-extrabold text-[#E31E24] min-w-[28px] opacity-55 pt-[2px]">{s.num}</div>
              <div>
                <div className="font-jakarta text-[16px] font-bold text-[#F8FAFC] mb-[6px]">{s.title}</div>
                <div className="text-[13.5px] text-[#94A3B8] leading-[1.6] mb-[10px]">{s.desc}</div>
                <div className="text-[13px] text-[#64748B] leading-[1.65]">{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-[6%] pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-[1000px] mx-auto">
          {principles.map((p) => (
            <div key={p.title} className="bg-[#1A2438] border border-[rgba(255,255,255,0.07)] rounded-[14px] p-6">
              <div className="font-jakarta text-[15px] font-bold text-[#F8FAFC] mb-[8px]">{p.title}</div>
              <div className="text-[13px] text-[#94A3B8] leading-[1.65]">{p.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="pb-24 px-[6%] text-center">
        <div className="max-w-[580px] mx-auto rounded-[20px] p-[48px_40px]" style={{ background: 'linear-gradient(135deg,rgba(227,30,36,.1),rgba(245,158,11,.06))', border: '1px solid rgba(227,30,36,.25)' }}>
          <h2 className="font-jakarta text-[clamp(22px,3vw,32px)] font-extrabold text-[#F8FAFC] mb-[14px] tracking-[-.02em]">Ready to stop doing<br />everything manually?</h2>
          <p className="text-[15px] text-[#94A3B8] mb-[30px] leading-[1.6]">Start a free workspace. Set up your team in 10 minutes. Let Pisairtel ERP do the rest.</p>
          <Link href="/signup" className="inline-flex items-center gap-2 px-7 py-[13px] rounded-[10px] text-white font-jakarta text-sm font-bold transition-transform hover:-translate-y-[2px]" style={{ background: 'linear-gradient(135deg,#E31E24,#C0208A)', boxShadow: '0 6px 20px rgba(227,30,36,.4)' }}>
            Get started free
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12,5 19,12 12,19" /></svg>
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
