import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav } from '@/components/marketing/site-nav';
import { SiteFooter } from '@/components/marketing/site-footer';

export const metadata: Metadata = {
  title: 'Support — Pisairtel ERP',
  description: 'Get help with Pisairtel ERP — account access, billing, and product questions.',
};

const cards = [
  {
    title: 'Account & access',
    desc: 'Trouble signing in, workspace access, or user management questions.',
    cta: 'Sign in to your workspace',
    href: '/login',
  },
  {
    title: 'Getting started',
    desc: 'Create a free workspace and connect your first module in minutes.',
    cta: 'Create a workspace',
    href: '/signup',
  },
  {
    title: 'Plans & billing',
    desc: 'Questions about plans, seats, and upgrading or downgrading.',
    cta: 'View pricing',
    href: '/pricing',
  },
];

export default function SupportPage() {
  return (
    <div className="bg-[#0B1120] min-h-screen overflow-x-hidden">
      <SiteNav />
      <main className="pt-[140px] pb-24 px-[6%]">
        <div className="max-w-[900px] mx-auto">
          <div className="text-center mb-14">
            <div className="text-[11.5px] font-semibold tracking-[.1em] text-[#E8286E] mb-[14px]">SUPPORT</div>
            <h1 className="font-jakarta text-[clamp(30px,4vw,44px)] font-extrabold tracking-[-.02em] text-[#F8FAFC] mb-[14px]">How can we help?</h1>
            <p className="text-[15px] text-[#94A3B8] leading-[1.7] max-w-[520px] mx-auto">
              Quick links to common tasks below — or email us and we&apos;ll get back to you.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-14">
            {cards.map((c) => (
              <div key={c.title} className="bg-[#1A2438] border border-[rgba(255,255,255,0.07)] rounded-[14px] p-6 flex flex-col">
                <div className="font-jakarta text-[15px] font-bold text-[#F8FAFC] mb-[8px]">{c.title}</div>
                <p className="text-[13px] text-[#94A3B8] leading-[1.6] mb-[18px] flex-1">{c.desc}</p>
                <Link href={c.href} className="text-[13px] text-[#E8286E] font-semibold hover:text-[#F59E0B] transition-colors">
                  {c.cta} →
                </Link>
              </div>
            ))}
          </div>

          <div className="bg-[#1A2438] border border-[rgba(255,255,255,0.07)] rounded-[14px] p-8 text-center">
            <h2 className="font-jakarta text-[18px] font-bold text-[#F8FAFC] mb-[8px]">Contact us</h2>
            <p className="text-[14px] text-[#94A3B8] leading-[1.7] mb-[18px]">
              For everything else — product questions, enterprise plans, data requests — email us directly.
            </p>
            <a href="mailto:support@pisairtel.io" className="inline-flex items-center gap-2 px-6 py-[12px] rounded-[10px] text-white font-jakarta text-sm font-bold transition-transform hover:-translate-y-[1px]" style={{ background: 'linear-gradient(135deg,#E31E24,#C0208A)', boxShadow: '0 4px 14px rgba(227,30,36,.35)' }}>
              support@pisairtel.io
            </a>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
