import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav } from '@/components/marketing/site-nav';
import { SiteFooter } from '@/components/marketing/site-footer';

export const metadata: Metadata = {
  title: 'Features — Pisairtel ERP',
  description: 'Finance, CRM, HR, Inventory, Approvals, and live reporting — connected and automated in one system.',
};

const modules = [
  {
    title: 'Finance',
    color: '#E31E24',
    desc: 'Invoice to payment in one automated chain. Expenses, bills, budgets, and GL — no manual posting.',
    bullets: [
      'Automated invoice generation from won deals',
      'Expense capture with policy-aware approvals',
      'Bills, payments, and 3-way matching built in',
      'General ledger updated on every transaction',
    ],
  },
  {
    title: 'CRM',
    color: '#F59E0B',
    desc: 'Contacts to closed deals. When a deal is won, invoices, projects, and pick orders fire automatically.',
    bullets: [
      'Lead capture and pipeline management',
      'Customer records linked to every transaction',
      'Deal stages that trigger downstream workflows',
      'Full activity history per account',
    ],
  },
  {
    title: 'HR & Payroll',
    color: '#10B981',
    desc: 'Hire an employee and payroll, cost center, and RBAC role are all set up. Every month, it runs itself.',
    bullets: [
      'Employee records and org structure',
      'Leave requests with automated approval routing',
      'Payroll runs tied to attendance and cost centers',
      'Self-service employee portal',
    ],
  },
  {
    title: 'Inventory',
    color: '#E8286E',
    desc: 'Every sale posts COGS to your GL. Every low-stock item drafts a PO. Your balance sheet stays current.',
    bullets: [
      'Real-time stock levels across locations',
      'Automatic reorder points and draft POs',
      'COGS posting on every sale',
      'Stock transfers with audit trails',
    ],
  },
  {
    title: 'Smart Approvals',
    color: '#F59E0B',
    desc: 'Threshold-aware, role-routed, and mobile-ready. Expenses escalate automatically. Nothing gets stuck.',
    bullets: [
      'Amount-based escalation paths',
      'Role-aware routing to the right approver',
      'Automatic reminders and escalations',
      'Full audit trail on every decision',
    ],
  },
  {
    title: 'Live Reports',
    color: '#10B981',
    desc: 'P&L, balance sheet, cash flow — updated on every transaction. No waiting for month-end.',
    bullets: [
      'Real-time P&L and balance sheet',
      'Cash flow visibility on demand',
      'Departmental and project-level reporting',
      'Export-ready financial statements',
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="bg-[#0B1120] min-h-screen overflow-x-hidden">
      <SiteNav />

      <section className="pt-[140px] pb-20 px-[6%] text-center">
        <div className="text-[11.5px] font-semibold tracking-[.1em] text-[#E8286E] mb-[14px]">MODULES</div>
        <h1 className="font-jakarta text-[clamp(34px,5vw,56px)] font-extrabold tracking-[-.02em] text-[#F8FAFC] leading-[1.15] mb-[18px]">
          Every part of your business,<br />connected and automated
        </h1>
        <p className="text-[15px] text-[#94A3B8] leading-[1.7] max-w-[560px] mx-auto">
          Pisairtel ERP replaces the patchwork of disconnected tools with one system where every module talks to the next.
        </p>
      </section>

      <section className="px-[6%] pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[1100px] mx-auto">
          {modules.map((m) => (
            <div key={m.title} className="bg-[#1A2438] border border-[rgba(255,255,255,0.07)] rounded-[14px] p-8 transition-all duration-300 hover:-translate-y-1">
              <div className="w-11 h-11 rounded-[10px] mb-[18px] flex items-center justify-center" style={{ background: `${m.color}22` }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
              </div>
              <div className="font-jakarta text-[18px] font-bold text-[#F8FAFC] mb-[9px]">{m.title}</div>
              <p className="text-[13.5px] text-[#94A3B8] leading-[1.65] mb-[18px]">{m.desc}</p>
              <ul className="space-y-[10px]">
                {m.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-[10px] text-[13.5px] text-[#94A3B8]">
                    <svg className="mt-[2px] flex-shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="2.5"><polyline points="20,6 9,17 4,12" /></svg>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="pb-24 px-[6%] text-center">
        <div className="max-w-[580px] mx-auto rounded-[20px] p-[48px_40px]" style={{ background: 'linear-gradient(135deg,rgba(227,30,36,.1),rgba(245,158,11,.06))', border: '1px solid rgba(227,30,36,.25)' }}>
          <h2 className="font-jakarta text-[clamp(22px,3vw,32px)] font-extrabold text-[#F8FAFC] mb-[14px] tracking-[-.02em]">See it all working together</h2>
          <p className="text-[15px] text-[#94A3B8] mb-[30px] leading-[1.6]">Start a free workspace and connect your first module in minutes.</p>
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
