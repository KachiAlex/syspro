import type { Metadata } from 'next';
import { SiteNav } from '@/components/marketing/site-nav';
import { SiteFooter } from '@/components/marketing/site-footer';

export const metadata: Metadata = {
  title: 'Terms of Service — Pisairtel ERP',
  description: 'The terms that govern your use of Pisairtel ERP.',
};

const sections = [
  {
    title: 'The service',
    body: 'Pisairtel ERP provides a cloud-based workspace for managing CRM, finance, HR, inventory, projects, and related business operations. Access is provided per workspace (tenant) and per user.',
  },
  {
    title: 'Your account',
    body: 'You are responsible for the accuracy of the information you provide, for keeping your credentials confidential, and for all activity that occurs under your workspace. Workspace administrators are responsible for managing user access and roles.',
  },
  {
    title: 'Acceptable use',
    body: 'You agree not to misuse the service — including attempting to access other tenants\u2019 data, disrupting the platform, or using it for unlawful purposes. We may suspend workspaces that violate these terms.',
  },
  {
    title: 'Your data',
    body: 'You retain ownership of the business data you enter. You grant us the right to process it solely to provide and improve the service, as described in the Privacy Policy.',
  },
  {
    title: 'Billing',
    body: 'Paid plans are billed in advance per the pricing terms shown at signup. Free workspaces may be subject to usage limits described on the Pricing page.',
  },
  {
    title: 'Availability & liability',
    body: 'We work to keep the service reliable but do not guarantee uninterrupted availability. To the extent permitted by law, our liability is limited to the fees you paid in the preceding 12 months.',
  },
  {
    title: 'Changes',
    body: 'We may update these terms from time to time. Material changes will be communicated through the workspace or by email before they take effect.',
  },
];

export default function TermsPage() {
  return (
    <div className="bg-[#0B1120] min-h-screen overflow-x-hidden">
      <SiteNav />
      <main className="pt-[140px] pb-24 px-[6%]">
        <div className="max-w-[720px] mx-auto">
          <h1 className="font-jakarta text-[clamp(30px,4vw,44px)] font-extrabold tracking-[-.02em] text-[#F8FAFC] mb-[10px]">Terms of Service</h1>
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
