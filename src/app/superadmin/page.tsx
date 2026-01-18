import { ArrowRight, CheckCircle2, CircleDashed, PlusCircle } from "lucide-react";
import { Panel, SectionHeading, Tag } from "@/components/ui/primitives";
import { provisioningBacklog, tenantSummaries } from "@/lib/mock-data";

export default function SuperadminPage() {
  return (
    <div className="min-h-screen bg-[#04050f] text-white">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-[#1ff0d8]/20 via-transparent to-transparent" />
        <div className="absolute right-[-10%] top-1/2 h-72 w-72 -translate-y-1/2 rounded-full blur-[180px]" style={{ background: "rgba(127, 91, 255, 0.35)" }} />
      </div>

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12 lg:px-10">
        <header className="rounded-[40px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <Tag tone="indigo">Superadmin Command</Tag>
              <h1 className="text-4xl font-semibold tracking-tight">Produce tenants. Orchestrate the mesh.</h1>
              <p className="max-w-2xl text-sm text-white/70 lg:text-base">
                Manage every tenant environment, provision copilots, and notarize policy updates. This dashboard mirrors what our AI control plane enforces in production.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Panel className="space-y-1" variant="frost">
                <p className="text-xs uppercase tracking-[0.35em] text-white/50">Active tenants</p>
                <p className="text-3xl font-semibold">37</p>
                <p className="text-xs text-emerald-300">+4 in last 30 days</p>
              </Panel>
              <Panel className="space-y-1" variant="frost">
                <p className="text-xs uppercase tracking-[0.35em] text-white/50">Copilot skills</p>
                <p className="text-3xl font-semibold">82</p>
                <p className="text-xs text-white/60">12 awaiting approval</p>
              </Panel>
            </div>
          </div>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <Panel className="space-y-6" variant="glass">
            <div className="flex items-center justify-between">
              <SectionHeading eyebrow="Tenant ledger" title="Live tenants" description="Every action mirrored to compliance twin" />
              <button className="inline-flex items-center gap-2 text-xs font-semibold text-white/70 hover:text-white">
                Export CSV
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="divide-y divide-white/10 rounded-3xl border border-white/10">
              <div className="grid grid-cols-5 gap-4 px-6 py-3 text-xs uppercase tracking-[0.35em] text-white/40">
                <span>Name</span>
                <span>Region</span>
                <span>Status</span>
                <span>Ledger delta</span>
                <span>Seats</span>
              </div>
              {tenantSummaries.map((tenant) => (
                <div key={tenant.name} className="grid grid-cols-5 gap-4 px-6 py-4 text-sm">
                  <span className="font-semibold">{tenant.name}</span>
                  <span className="text-white/70">{tenant.region}</span>
                  <span className={`text-sm ${tenant.status === "Live" ? "text-emerald-300" : "text-amber-300"}`}>{tenant.status}</span>
                  <span className="text-white/80">{tenant.ledger}</span>
                  <span className="text-white/60">{tenant.seats}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel variant="glass">
            <SectionHeading eyebrow="Tenant creation" title="Mint a new tenant" description="Spin infra, seed datasets, and assign copilots" />
            <form className="mt-6 space-y-4 text-sm">
              <div>
                <label htmlFor="tenantName" className="text-xs uppercase tracking-[0.35em] text-white/50">
                  Tenant name
                </label>
                <input
                  id="tenantName"
                  name="tenantName"
                  placeholder="e.g. Aurora Plastics"
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="region" className="text-xs uppercase tracking-[0.35em] text-white/50">
                  Region
                </label>
                <select
                  id="region"
                  name="region"
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-white focus:border-white/40 focus:outline-none"
                >
                  <option value="">Select region</option>
                  <option value="emea">EMEA</option>
                  <option value="na">North America</option>
                  <option value="latam">LATAM</option>
                  <option value="apac">APAC</option>
                </select>
              </div>
              <div>
                <label htmlFor="copilots" className="text-xs uppercase tracking-[0.35em] text-white/50">
                  Copilot bundle
                </label>
                <input
                  id="copilots"
                  name="copilots"
                  placeholder="Planner + Supplier + Treasury"
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <button type="button" className="flex items-center justify-center gap-2 rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 hover:text-white">
                  <CircleDashed className="h-4 w-4" />
                  Draft
                </button>
                <button type="button" className="group flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#05060a]">
                  <PlusCircle className="h-4 w-4" />
                  Launch tenant
                </button>
              </div>
              <p className="text-xs text-white/60">Provisioning takes ~4 minutes. We notify onsite teams when ledgers sync.</p>
            </form>
          </Panel>
        </section>

        <section className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <Panel variant="card" className="space-y-6">
            <SectionHeading eyebrow="Compliance" title="Policy pulses" description="All superadmin moves notarized" />
            <div className="space-y-4 text-sm text-white/80">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 p-4">
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                <p>Ledger parity checks green across all live tenants.</p>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 p-4">
                <CircleDashed className="h-5 w-5 text-amber-300" />
                <p>3 policy playbooks awaiting human review before copilot rollout.</p>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 p-4">
                <CircleDashed className="h-5 w-5 text-sky-300" />
                <p>KYC refresh cycle begins Feb 1 — schedule tenant attestations.</p>
              </div>
            </div>
          </Panel>

          <Panel variant="card" className="space-y-4">
            <div className="flex items-center justify-between">
              <SectionHeading eyebrow="Worklist" title="Provisioning backlog" description="Synced with ops war-room" />
              <button className="text-xs uppercase tracking-[0.35em] text-white/60">View all</button>
            </div>
            <div className="space-y-3">
              {provisioningBacklog.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm">
                  <div className="flex items-center justify-between text-xs text-white/50">
                    <span>{item.id}</span>
                    <span>{item.state}</span>
                  </div>
                  <p className="mt-2 font-semibold">{item.item}</p>
                  <p className="text-xs text-white/60">Owner · {item.owner}</p>
                </div>
              ))}
            </div>
          </Panel>
        </section>
      </main>
    </div>
  );
}
