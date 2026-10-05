import type { Metadata } from 'next';
import { SiteNav } from '@/components/marketing/site-nav';
import { SiteFooter } from '@/components/marketing/site-footer';

export const metadata: Metadata = {
  title: 'Privacy Policy — Pisairtel ERP',
  description: 'How Pisairtel ERP collects, uses, and protects your data.',
};

const sections = [
  {
    title: 'Data we collect',
    body: 'We collect the information needed to run your workspace: account details (name, email), company information, and the business data you enter into the platform (customers, transactions, employees, and similar records). We also collect standard technical data such as IP addresses and browser type for security and diagnostics.',
  },
  {
    title: 'How we use it',
    body: 'Your data is used to operate, maintain, and improve the service — including authentication, automation workflows, reporting, and support. We do not sell your data to third parties.',
  },
  {
    title: 'Data isolation',
    body: 'Each workspace is a separate tenant. Your business data is only accessible to users within your workspace and is never shared with other tenants.',
  },
  {
    title: 'Security',
    body: 'Passwords are stored as bcrypt hashes. Sessions use signed, httpOnly cookies. Access within a workspace is governed by role-based permissions that your administrator controls.',
  },
  {
    title: 'Retention & deletion',
    body: 'You can request export or deletion of your workspace data at any time via the Support page. When a workspace is deleted, its data is permanently removed from our systems.',
  },
  {
    title: 'Contact',
    body: 'Questions about this policy or your data? Reach us through the Support page.',
  },
];

export default function PrivacyPage() {
  return (
    <div className="bg-[#0B1120] min-h-screen overflow-x-hidden">
      <SiteNav />
      <main className="pt-[140px] pb-24 px-[6%]">
        <div className="max-w-[720px] mx-auto">
          <h1 className="font-jakarta text-[clamp(30px,4vw,44px)] font-extrabold tracking-[-.02em] text-[#F8FAFC] mb-[10px]">Privacy Policy</h1>
          <p className="text-[13px] text-[#64748B] mb-12">Last updated: October 2026</p>
          <div className="space-y-8">
            {sections.map((s) => (
              <section key={s.title}>
                <h2 className="font-jakarta text-[16px] font-bold text-[#F8FAFC] mb-[8px]">{s.title}</h2>
                <p className="text-[14px] text-[#94A3B8] leading-[1.75]">{s.body}</p>
              </section>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
