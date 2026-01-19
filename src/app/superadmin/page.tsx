"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2, CircleDashed, PlusCircle, X } from "lucide-react";
import { Panel, SectionHeading, Tag } from "@/components/ui/primitives";
import { provisioningBacklog, tenantSummaries } from "@/lib/mock-data";

export default function SuperadminPage() {
  const [showTenantModal, setShowTenantModal] = useState(false);

  function handleTenantSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Placeholder for backend call. Close modal for now.
    setShowTenantModal(false);
  }

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

          <Panel variant="glass" className="space-y-6">
            <SectionHeading eyebrow="Tenant creation" title="Mint a new tenant" description="Spin infra, seed datasets, and assign copilots" />
            <p className="text-sm text-white/70">
              Draft a multi-tenant blueprint, load compliance templates, then hand the admin keys to the customer champion. We notarize every provisioning step.
            </p>
            <div className="grid gap-4 text-sm text-white/70 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.35em] text-white/40">Blueprint runtime</p>
                <p className="mt-2 text-2xl font-semibold text-white">~4 min</p>
                <p className="text-xs text-white/50">Includes ledger sync + copilot seeding</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.35em] text-white/40">Latest tenants</p>
                <p className="mt-2 text-2xl font-semibold text-white">Tembea • NovaFoods</p>
                <p className="text-xs text-white/50">Next up · Skyline Energy</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-white/60">
              <span className="rounded-full border border-white/15 px-4 py-1.5">ISO playbook attached</span>
              <span className="rounded-full border border-white/15 px-4 py-1.5">KYC warm start</span>
              <span className="rounded-full border border-white/15 px-4 py-1.5">Copilot catalog synced</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <button type="button" className="flex items-center justify-center gap-2 rounded-2xl border border-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 hover:text-white">
                <CircleDashed className="h-4 w-4" />
                Draft deck
              </button>
              <button
                type="button"
                onClick={() => setShowTenantModal(true)}
                className="group flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#05060a]"
              >
                <PlusCircle className="h-4 w-4" />
                Create tenant
              </button>
            </div>
            <p className="text-xs text-white/60">Provisioning tasks auto-sync to the backlog once you publish.</p>
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

        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <Panel variant="glass" className="space-y-6">
            <SectionHeading eyebrow="Licensing" title="Recommended commercial model" description="Blend governance fees with usage-based expansion" />
            <div className="grid gap-4 text-sm text-white/80 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.35em] text-white/50">Platform retainer</p>
                <p className="mt-2 text-2xl font-semibold text-white">$12k / tenant / mo</p>
                <p className="text-xs text-white/60">Covers multi-tenant hosting, policy layer, and support SLAs.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.35em] text-white/50">Seat bundles</p>
                <p className="mt-2 text-2xl font-semibold text-white">$120 / persona</p>
                <p className="text-xs text-white/60">Planner, supplier, finance, treasury seats pooled & auto true-up.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.35em] text-white/50">Data-plane add-ons</p>
                <p className="mt-2 text-2xl font-semibold text-white">$0.45 / tx</p>
                <p className="text-xs text-white/60">Sovereign storage, ESG copilots, and supplier mesh usage.</p>
              </div>
            </div>
            <p className="text-sm text-white/70">
              Tenants commit to an annual platform retainer, then flex seats by persona tier. Data-plane add-ons meter heavy workloads (ledger sync, AI copilots, supplier mesh calls) so operations teams can forecast spend per business unit.
            </p>
            <div className="space-y-3 text-sm text-white/70">
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-emerald-200">Why</span>
                <p>Aligns with multi-tenant ERP economics: predictable governance fee + transparent growth lever for adoption.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-sky-300/30 bg-sky-300/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-sky-200">Next</span>
                <p>Expose sliders in this console so superadmins can model invoices, then sync outputs to billing + CRM.</p>
              </div>
            </div>
          </Panel>
          <Panel variant="card" className="space-y-4">
            <SectionHeading eyebrow="Packaging" title="Bundle recommendations" description="Mix personas + copilots for each industry" />
            <ul className="space-y-3 text-sm text-white/75">
              <li className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-white font-semibold">Industrial Core</p>
                <p className="text-xs text-white/60">Planner + Supplier copilots · 200 seats · ESG add-on for regulators.</p>
              </li>
              <li className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-white font-semibold">Finance Command</p>
                <p className="text-xs text-white/60">Treasury + ledger copilots · 80 seats · Data-plane priority channel.</p>
              </li>
              <li className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-white font-semibold">Supplier Mesh Pro</p>
                <p className="text-xs text-white/60">Shared supplier workspace · pay-per-transaction mesh calls.</p>
              </li>
            </ul>
            <p className="text-xs text-white/60">Document these bundles in RevOps to auto-generate licensing schedules during tenant onboarding.</p>
          </Panel>
        </section>
      </main>

      {showTenantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#01020a]/80 px-4 py-10 backdrop-blur-md">
          <div className="relative w-full max-w-4xl rounded-[32px] border border-white/10 bg-[#04050f] p-8 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowTenantModal(false)}
              className="absolute right-6 top-6 rounded-full border border-white/20 p-2 text-white/70 hover:text-white"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex flex-col gap-3">
              <Tag tone="teal">Create tenant</Tag>
              <h2 className="text-3xl font-semibold">Onboard a new company</h2>
              <p className="text-sm text-white/70">Collect core company details and designate the founding admin. We’ll provision infra + credentials in one pass.</p>
            </div>
            <form onSubmit={handleTenantSubmit} className="mt-8 grid gap-8 lg:grid-cols-2">
              <div className="space-y-5">
                <SectionHeading eyebrow="Company" title="Tenant blueprint" description="Name, sector, and routing metadata" />
                <div className="space-y-4 text-sm">
                  <div>
                    <label htmlFor="company-name" className="text-xs uppercase tracking-[0.35em] text-white/50">
                      Company name
                    </label>
                    <input
                      id="company-name"
                      name="company-name"
                      placeholder="Aurora Plastics"
                      className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="company-slug" className="text-xs uppercase tracking-[0.35em] text-white/50">
                      Tenant slug
                    </label>
                    <input
                      id="company-slug"
                      name="company-slug"
                      placeholder="aurora-plastics"
                      className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="region" className="text-xs uppercase tracking-[0.35em] text-white/50">
                        Region
                      </label>
                      <select
                        id="region"
                        name="region"
                        className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white focus:border-white/40 focus:outline-none"
                      >
                        <option value="">Select region</option>
                        <option value="emea">EMEA</option>
                        <option value="na">North America</option>
                        <option value="latam">LATAM</option>
                        <option value="apac">APAC</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="industry" className="text-xs uppercase tracking-[0.35em] text-white/50">
                        Industry
                      </label>
                      <input
                        id="industry"
                        name="industry"
                        placeholder="Advanced manufacturing"
                        className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="headcount" className="text-xs uppercase tracking-[0.35em] text-white/50">
                      Approx. seats
                    </label>
                    <input
                      id="headcount"
                      name="headcount"
                      placeholder="> 250 employees"
                      className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-5">
                <SectionHeading eyebrow="Admin" title="Founding admin" description="Primary contact credentials" />
                <div className="space-y-4 text-sm">
                  <div>
                    <label htmlFor="admin-name" className="text-xs uppercase tracking-[0.35em] text-white/50">
                      Admin name
                    </label>
                    <input
                      id="admin-name"
                      name="admin-name"
                      placeholder="Adaora Umeh"
                      className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="admin-email" className="text-xs uppercase tracking-[0.35em] text-white/50">
                      Admin email
                    </label>
                    <input
                      id="admin-email"
                      name="admin-email"
                      type="email"
                      placeholder="admin@aurora.com"
                      className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="admin-password" className="text-xs uppercase tracking-[0.35em] text-white/50">
                        Password
                      </label>
                      <input
                        id="admin-password"
                        name="admin-password"
                        type="password"
                        placeholder="••••••••"
                        className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="confirm-password" className="text-xs uppercase tracking-[0.35em] text-white/50">
                        Confirm
                      </label>
                      <input
                        id="confirm-password"
                        name="confirm-password"
                        type="password"
                        placeholder="••••••••"
                        className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="admin-notes" className="text-xs uppercase tracking-[0.35em] text-white/50">
                      Notes for ops
                    </label>
                    <textarea
                      id="admin-notes"
                      name="admin-notes"
                      rows={3}
                      placeholder="Kickoff call scheduled, requires ESG copilot."
                      className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="lg:col-span-2 flex flex-wrap items-center justify-between gap-4 text-sm">
                <p className="text-white/60">We hash admin credentials, ship the invite email, and mirror the blueprint to the provisioning backlog.</p>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowTenantModal(false)} className="rounded-2xl border border-white/20 px-5 py-3 text-white/70 hover:text-white">
                    Cancel
                  </button>
                  <button type="submit" className="group inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-semibold text-[#05060a]">
                    Deploy tenant
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
