"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CircuitBoard,
  LineChart,
  Wifi,
} from "lucide-react";

const productionNodes = [
  {
    plant: "Lagos Assembly",
    uptime: "92%",
    status: "Stable",
    signal: "+1.2%",
  },
  {
    plant: "Nairobi Plastics",
    uptime: "88%",
    status: "Watch",
    signal: "-3.4%",
  },
  {
    plant: "Accra Metals",
    uptime: "95%",
    status: "Optimal",
    signal: "+0.8%",
  },
];

const aiInsights = [
  {
    title: "Order Spike",
    detail: "Tier-1 automotive client pulled Q2 demand forward by 11%.",
    impact: "Adjust Camber plant shifts",
    severity: "high",
  },
  {
    title: "Supplier Delay",
    detail: "Copper cathode shipments at Tema port delayed 36 hours.",
    impact: "Trigger alternate rail route",
    severity: "medium",
  },
  {
    title: "Cash Flow",
    detail: "Multi-tenant ledger sees +6% collections efficiency this week.",
    impact: "Release CapEx batch",
    severity: "low",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#03030a] pb-16 text-white">
      <div className="absolute inset-0 -z-10 opacity-60">
        <div className="absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 blur-[120px]" style={{ background: "radial-gradient(circle, #28fde0 0%, transparent 70%)" }} />
        <div className="absolute right-10 bottom-0 h-[320px] w-[420px] blur-[120px]" style={{ background: "radial-gradient(circle, #7f5bff 0%, transparent 65%)" }} />
      </div>

      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-6 pt-10 lg:px-10">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-teal-200/80">
              SYS Neural Supply Mesh
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight lg:text-5xl">
              Planner Command Center
            </h1>
            <p className="mt-3 max-w-2xl text-base text-white/70">
              Cross-plant visibility, AI-prescribed moves, and tenant-aware ledgers in one canvas.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="group flex items-center gap-2 rounded-full border border-white/20 px-5 py-2 text-sm font-medium text-white/80 hover:border-white">
              Recalibrate Forecast
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
            <button className="rounded-full bg-white px-5 py-2 text-sm font-medium text-[#05060a]">
              Launch Scenario Lab
            </button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {["Forecast Accuracy", "Supply Risk", "Cash Position"].map((label, idx) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
            >
              <p className="text-sm uppercase tracking-[0.35em] text-white/50">{label}</p>
              <p className="mt-3 text-4xl font-semibold">
                {idx === 0 && "97.2%"}
                {idx === 1 && "4 nodes"}
                {idx === 2 && "+₦1.8B"}
              </p>
              <p className="mt-1 text-sm text-white/60">
                {idx === 0 && "+2.4% vs last week"}
                {idx === 1 && "requiring mitigation"}
                {idx === 2 && "available working capital"}
              </p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-6 backdrop-blur lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                  AI timeline
                </p>
                <h2 className="mt-2 text-2xl font-semibold">Signal Stream</h2>
              </div>
              <LineChart className="h-6 w-6 text-teal-200" />
            </div>

            <div className="mt-6 grid gap-3">
              {aiInsights.map((insight) => (
                <div
                  key={insight.title}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="mt-1 h-2 w-2 rounded-full" style={{
                    background:
                      insight.severity === "high"
                        ? "#ff8a9a"
                        : insight.severity === "medium"
                          ? "#ffd16b"
                          : "#7df7b0",
                  }} />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold leading-tight">{insight.title}</p>
                    <p className="text-sm text-white/70">{insight.detail}</p>
                    <p className="text-xs text-white/50">Action: {insight.impact}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.4em] text-white/50">Neural twin</p>
            <h2 className="mt-2 text-2xl font-semibold">Mesh Health</h2>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
                <div>
                  <p className="text-sm text-white/60">Telemetry</p>
                  <p className="text-lg font-semibold">118 streams live</p>
                </div>
                <Wifi className="h-5 w-5 text-teal-200" />
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
                <div>
                  <p className="text-sm text-white/60">Digital twin fidelity</p>
                  <p className="text-lg font-semibold">98.4%</p>
                </div>
                <CircuitBoard className="h-5 w-5 text-sky-200" />
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
                <div>
                  <p className="text-sm text-white/60">Alerts awaiting</p>
                  <p className="text-lg font-semibold">3 critical</p>
                </div>
                <AlertTriangle className="h-5 w-5 text-rose-300" />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/50">
                  Production nodes
                </p>
                <h2 className="mt-2 text-2xl font-semibold">Network Pulse</h2>
              </div>
              <Activity className="h-5 w-5 text-purple-200" />
            </div>

            <div className="mt-6 space-y-4">
              {productionNodes.map((node) => (
                <div key={node.plant} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div>
                    <p className="text-sm font-medium">{node.plant}</p>
                    <p className="text-xs text-white/50">{node.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white/60">Uptime</p>
                    <p className="text-lg font-semibold">{node.uptime}</p>
                    <p className={`text-xs ${node.signal.startsWith("-") ? "text-rose-300" : "text-emerald-300"}`}>
                      {node.signal}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/50">
                  Forecast theatre
                </p>
                <h2 className="mt-2 text-2xl font-semibold">Demand Horizon</h2>
              </div>
              <BarChart3 className="h-5 w-5 text-amber-200" />
            </div>

            <div className="mt-6 space-y-6">
              {["AUTOMOTIVE", "FMCG", "ENERGY"].map((sector, idx) => (
                <div key={sector}>
                  <div className="flex items-center justify-between text-xs text-white/50">
                    <span>{sector}</span>
                    <span>{idx === 0 ? "+14%" : idx === 1 ? "+7%" : "-3%"} next 6 weeks</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${idx === 0 ? "bg-teal-300" : idx === 1 ? "bg-indigo-300" : "bg-rose-300"}`}
                      style={{ width: idx === 0 ? "80%" : idx === 1 ? "55%" : "30%" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/15 to-white/5 p-6 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.35em] text-white/50">Ledger stream</p>
            <h2 className="mt-2 text-2xl font-semibold">Cash + Carbon</h2>

            <div className="mt-8 space-y-5">
              <div>
                <p className="text-xs text-white/60">Collections</p>
                <p className="text-3xl font-semibold">₦4.2B</p>
                <p className="text-xs text-emerald-300">+6% week / week</p>
              </div>
              <div>
                <p className="text-xs text-white/60">Emission budget</p>
                <p className="text-3xl font-semibold">72%</p>
                <p className="text-xs text-white/60">aligned to ESG targets</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
                Copilot suggests reallocating ₦420M idle cash toward copper buffering to outpace supplier delays.
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
