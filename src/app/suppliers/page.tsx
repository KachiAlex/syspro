import { ArrowRight, MessageSquare, PackageCheck, ShieldCheck } from "lucide-react";
import { MetricStat, Panel, PillButton, SectionHeading, Tag } from "@/components/ui/primitives";
import { collaborationBursts, partnerSignals, worklist } from "@/lib/mock-data";

export default function SupplierPortalPage() {
  return (
    <div className="min-h-screen bg-[#05060a] text-white">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-[#28fde0]/25 to-transparent" />
      </div>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 lg:px-10">
        <header className="flex flex-col gap-6 rounded-[40px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Tag tone="indigo">Partner Surface</Tag>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight">Supplier Collaboration Hub</h1>
            <p className="mt-3 max-w-3xl text-base text-white/70">
              Real-time accountability, AI-authored briefs, and shared ledgers so every supplier stays in lock-step with production.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <PillButton variant="secondary">
              View Scorecard
              <ArrowRight className="h-4 w-4" />
            </PillButton>
            <PillButton variant="primary">Open Dispute Workspace</PillButton>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Panel variant="glass">
            <MetricStat label="ASN compliance" value="98.2%" helper="+1.4% week / week" />
          </Panel>
          <Panel variant="glass">
            <MetricStat label="Avg. dispute cycle" value="6.2h" helper="resolved by shared ledger" />
          </Panel>
          <Panel variant="glass">
            <MetricStat label="Vendor ESG alignment" value="77%" helper="verified scope 1-3 data" />
          </Panel>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Panel>
            <div className="flex items-center justify-between">
              <SectionHeading eyebrow="Worklist" title="Your next moves" description="Prioritized by SYS Copilot" />
              <PackageCheck className="h-5 w-5 text-teal-200" />
            </div>

            <div className="mt-6 space-y-4">
              {worklist.map((item) => (
                <div key={item.id} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-white/50">{item.id} · {item.action}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
                    <span className="rounded-full bg-white/10 px-3 py-1">{item.priority}</span>
                    <span>{item.due}</span>
                    <button className="text-xs font-semibold text-white/70 hover:text-white">Open</button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="space-y-5">
            <div className="flex items-center justify-between">
              <SectionHeading eyebrow="Trust" title="Credential vault" description="One upload syncs to all buyers" />
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              • ISO 9001 renewal auto-shared.<br />• Carbon disclosure synced to SYS carbon ledger.<br />• Insurance rider pending co-sign → remind legal.
            </div>
            <PillButton variant="primary">Upload attestation</PillButton>
          </Panel>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Panel className="space-y-6">
            <SectionHeading eyebrow="Signals" title="Buyer pulse" />
            <div className="space-y-4">
              {partnerSignals.map((signal) => (
                <div key={signal.partner} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-sm font-semibold">{signal.partner}</p>
                  <p className="text-xs text-emerald-300">{signal.metric}</p>
                  <p className="mt-1 text-xs text-white/60">{signal.note}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="space-y-5">
            <SectionHeading eyebrow="Collab" title="Live briefs" />
            <div className="space-y-4">
              {collaborationBursts.map((burst) => (
                <div key={burst.title} className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>{burst.status}</span>
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <p className="mt-2 text-sm font-semibold">{burst.title}</p>
                  <p className="text-xs text-white/70">{burst.detail}</p>
                </div>
              ))}
            </div>
            <PillButton variant="secondary">
              View full workspace
              <ArrowRight className="h-4 w-4" />
            </PillButton>
          </Panel>

          <Panel className="space-y-4" variant="glass">
            <SectionHeading eyebrow="Ledger" title="Shared settlement" description="Multi-tenant accounting status" />
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs text-white/60">Open balance</p>
              <p className="text-3xl font-semibold">₦820M</p>
              <p className="text-xs text-emerald-300">+ cleared 92% within SLA</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs text-white/60">Carbon credit pool</p>
              <p className="text-3xl font-semibold">412 tCO₂e</p>
              <p className="text-xs text-white/60">eligible for shared offset</p>
            </div>
          </Panel>
        </section>
      </main>
    </div>
  );
}
