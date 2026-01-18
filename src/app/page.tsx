import {
  ArrowRight,
  BadgeCheck,
  CircuitBoard,
  Cpu,
  GaugeCircle,
  ShieldCheck,
  Sparkles,
  Waves,
} from "lucide-react";

const logos = ["Tembea Steel", "NovaFoods", "TransAfrica", "Skyline Energy"];

const featurePillars = [
  {
    label: "Finance Ops",
    title: "AI balanced ledgers",
    copy: "Close books daily, simulate FX exposure, and sync carbon budgets across every tenant.",
  },
  {
    label: "Manufacturing",
    title: "Digital twin execution",
    copy: "Blend production telemetry with demand signals to reroute capacity before turbulence hits.",
  },
  {
    label: "Supply Mesh",
    title: "Trusted partner mesh",
    copy: "Share autonomous playbooks with suppliers through consented, tenant-aware data rooms.",
  },
];

const stats = [
  { label: "Forecast precision", value: "97.2%", detail: "+3.4 pt YoY" },
  { label: "Working capital", value: "+₦1.8B", detail: "Freed in 60 days" },
  { label: "Carbon certainty", value: "92%", detail: "Scope 3 traced" },
];

const meshHighlights = [
  {
    title: "Neural constraint solver",
    body: "Model entire BOM hierarchies and instantly recompute viable scenarios as outages emerge.",
    icon: GaugeCircle,
  },
  {
    title: "Trusted data mesh",
    body: "Tenant isolation with lineage, policy controls, and audit friendly encryption at edge.",
    icon: ShieldCheck,
  },
  {
    title: "Event-driven autopilot",
    body: "Kafka-native blueprints orchestrate procurement, logistics, and treasury actions in sync",
    icon: Waves,
  },
];

const copilotMoments = [
  "Summarize supply risk posture per tenant",
  "Draft cash + carbon mitigation orders",
  "Interrogate real-time digital twins via natural language",
  "Launch scenario drills that notify partner war-rooms",
];

export default function Home() {
  return (
    <div className="relative overflow-hidden bg-[#03030a] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-[-10%] top-[-10%] h-[420px] w-[420px] rounded-full blur-[160px]"
          style={{ background: "rgba(75, 255, 230, 0.2)" }}
        />
        <div
          className="absolute right-[-15%] top-1/2 h-[520px] w-[520px] -translate-y-1/2 rounded-full blur-[180px]"
          style={{ background: "rgba(115, 80, 255, 0.25)" }}
        />
      </div>

      <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-24 px-6 pb-24 pt-12 lg:px-10">
        <section className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr]" id="hero">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.5em] text-teal-200/80">
              <Sparkles className="h-4 w-4" />
              Neural ERP
            </div>
            <div>
              <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white/95 lg:text-6xl">
                A command marketing surface for multi-tenant supply chains.
              </h1>
              <p className="mt-4 max-w-2xl text-base text-white/70 lg:text-lg">
                Syspro threads finance, production, and partner ecosystems into one cinematic experience. AI copilots choreograph cash, carbon, and capacity decisions—before disruption arrives.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href="/access"
                className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#05060a]"
              >
                Launch Access Portal
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
              <button className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm text-white/80 hover:text-white">
                Download deck
              </button>
            </div>
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.35em] text-white/50">Trusted by adaptive manufacturers</p>
              <div className="flex flex-wrap gap-6 text-white/60">
                {logos.map((logo) => (
                  <span key={logo} className="text-sm tracking-[0.3em]">
                    {logo}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur">
            <div className="space-y-2 text-xs uppercase tracking-[0.35em] text-white/50">
              <span>Live mesh signal</span>
              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            </div>
            <div className="mt-6 grid gap-6">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs text-white/50">{stat.label}</p>
                  <p className="text-3xl font-semibold">{stat.value}</p>
                  <p className="text-xs text-emerald-300">{stat.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 rounded-2xl border border-white/15 bg-gradient-to-br from-white/10 to-white/0 p-5 text-sm text-white/70">
              “Syspro rebuilt our operating rhythm—we forecast in hours, not quarters, while tracing every scope 3 gram.” — Chief Supply Officer, Tembea Steel
            </div>
          </div>
        </section>

        <section id="platform" className="space-y-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/50">Platform</p>
              <h2 className="mt-2 text-3xl font-semibold">An opinionated surface for tenants, copilots, and superadmins.</h2>
            </div>
            <div className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/60">
              Persona-aware navigation
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {featurePillars.map((pillar) => (
              <div key={pillar.title} className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.45em] text-white/50">{pillar.label}</p>
                <h3 className="mt-3 text-2xl font-semibold">{pillar.title}</h3>
                <p className="mt-3 text-sm text-white/70">{pillar.copy}</p>
                <div className="mt-6 inline-flex items-center gap-2 text-xs text-white/70">
                  <BadgeCheck className="h-4 w-4 text-emerald-300" />
                  Multi-tenant ready
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="mesh" className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[32px] border border-white/10 bg-gradient-to-br from-white/10 to-white/0 p-8 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.4em] text-white/50">Neural mesh</p>
            <h2 className="mt-4 text-3xl font-semibold">Digital twins breathing in telemetry + finance.</h2>
            <p className="mt-4 text-sm text-white/70">
              Bring together planner canvases, supplier bursts, and treasury instructions over an event mesh powered by Kafka + Pulsar. Every signal is versioned and replayable for audits.
            </p>
            <div className="mt-8 space-y-5">
              {meshHighlights.map(({ title, body, icon: Icon }) => (
                <div key={title} className="flex gap-4 rounded-2xl border border-white/10 bg-black/30 p-5">
                  <Icon className="h-6 w-6 text-teal-200" />
                  <div>
                    <p className="text-base font-semibold">{title}</p>
                    <p className="text-sm text-white/70">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/50">Mesh console</p>
                <h3 className="mt-2 text-xl font-semibold">Live telemetry fabric</h3>
              </div>
              <CircuitBoard className="h-6 w-6 text-sky-200" />
            </div>
            <div className="mt-8 grid gap-6 text-sm">
              {["13 telemetry clusters synced", "118 partner nodes live", "4 alerts muted via autopilot", "98.4% twin fidelity"].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-black/25 p-5">
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-8 rounded-2xl border border-white/10 bg-black/40 p-5 text-xs text-white/60">
              All actions notarized to tenant-ledgers with cryptographic proofs. Superadmins gain oversight without touching proprietary tenant data.
            </div>
          </div>
        </section>

        <section id="copilot" className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.4em] text-white/50">AI Copilot</p>
            <h2 className="mt-3 text-3xl font-semibold">Conversational command mesh.</h2>
            <p className="mt-4 text-sm text-white/70">
              Copilot fuses GPT-class reasoning with your policies, orchestrating playbooks across finance, supply, and ESG teams.
            </p>
            <div className="mt-8 space-y-4">
              {copilotMoments.map((moment) => (
                <div key={moment} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/30 p-5">
                  <Cpu className="mt-1 h-5 w-5 text-emerald-200" />
                  <p className="text-sm text-white/80">{moment}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[32px] border border-white/10 bg-gradient-to-br from-white/10 to-white/0 p-8 backdrop-blur">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.4em] text-white/50">Superadmin view</p>
              <h3 className="text-2xl font-semibold">Provision tenants, ship copilots, audit impact.</h3>
              <p className="text-sm text-white/70">
                Build once, configure per tenant. The superadmin dashboard lets you mint environments, curate partner-level policies, and publish copilot skills with rollback safety.
              </p>
            </div>
            <div className="mt-8 grid gap-4 text-sm text-white/80">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 p-4">
                <span>Tenants deployed</span>
                <span className="text-2xl font-semibold">37</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 p-4">
                <span>Copilot skills live</span>
                <span className="text-2xl font-semibold">82</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 p-4">
                <span>Policy updates this week</span>
                <span className="text-2xl font-semibold">14</span>
              </div>
            </div>
            <div className="mt-8 rounded-2xl border border-white/10 bg-black/40 p-5 text-xs text-white/60">
              Ready to activate a tenant? Hop into the access portal to launch superadmin tooling and begin orchestrating the mesh.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
