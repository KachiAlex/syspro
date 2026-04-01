'use client';

import { ArrowRight, Play, Check, Sparkles, Shield, LineChart, Globe2, Layers, ServerCog, Briefcase, Users, Zap } from 'lucide-react';
import { ImageWithFallback } from '@/components/ImageWithFallback';

const navLinks = [
  { label: 'Product', href: '#features' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Resources', href: '#resources' },
];

const marqueeLogos = ['Northway Logistics', 'Apex Manufacturing', 'Helix MedTech', 'Orbit Supply', 'Nova Energy'];

const heroStats = [
  { value: '40%', label: 'Average ROI in year one' },
  { value: '82%', label: 'Workflows automated end-to-end' },
  { value: '94%', label: 'Week-one adoption across teams' },
];

const momentumMetrics = [
  { value: '14 days', label: 'Time to first automated process' },
  { value: '6×', label: 'Faster close for finance orgs' },
  { value: '99.9%', label: 'Realtime uptime across regions' },
  { value: '24/7', label: 'Follow-the-sun success architects' },
];

const modules = [
  {
    icon: Users,
    title: 'Revenue & CRM',
    description: 'Forecast with AI scoring, orchestrate account health, and automate renewals in one console.',
    accent: 'from-sky-500 to-blue-500',
  },
  {
    icon: LineChart,
    title: 'Finance & Planning',
    description: 'Multi-entity consolidation, scenario modeling, and anomaly alerts that keep finance ahead.',
    accent: 'from-emerald-500 to-teal-500',
  },
  {
    icon: Globe2,
    title: 'Operations Command',
    description: 'Telemetry dashboards for plants, inventory heatmaps, and fulfillment exception routing.',
    accent: 'from-indigo-500 to-cyan-500',
  },
  {
    icon: Zap,
    title: 'Automation Studio',
    description: 'Drag-and-drop runbooks across apps, approvals, and messaging with safe-guarded governance.',
    accent: 'from-violet-500 to-fuchsia-500',
  },
  {
    icon: Briefcase,
    title: 'Workforce HQ',
    description: 'Onboarding, shift planning, and compliance attestations that stay in lockstep with operations.',
    accent: 'from-amber-500 to-orange-500',
  },
  {
    icon: Shield,
    title: 'Platform Admin',
    description: 'Granular permissions, policy engines, and audit trails purpose-built for multi-tenant scale.',
    accent: 'from-slate-600 to-slate-800',
  },
];

const operationsHighlights = [
  {
    title: 'Telemetry-grade visibility',
    description: 'Blend live plant signals, fulfillment statuses, and financial health in a single command view.',
    bullets: ['Digital twin overlays with variance heatmaps', 'Exception routing with accountable owners', 'Predictive scoring for every workflow'],
  },
  {
    title: 'Closed-loop automation',
    description: 'Escalations, approvals, and reconciliation flows hand off context automatically—no human swivel.',
    bullets: ['Adaptive approvals with guardrails baked in', 'Policy packs for regulated industries', 'Native integrations for ERP, PLM, and HRIS'],
  },
];

const platformCallouts = [
  {
    icon: Layers,
    title: 'Unified data mesh',
    description: 'Streaming ingestion keeps finance, supply chain, and workforce telemetry in sync with millisecond latency.',
  },
  {
    icon: ServerCog,
    title: 'Governed automation engine',
    description: 'Versioned runbooks with approvals, rollback plans, and compliance evidence captured on every execution.',
  },
];

const testimonials = [
  {
    name: 'Sarah Johnson',
    role: 'CEO · TechCorp Solutions',
    quote:
      'We sunset five legacy systems in 90 days. Leadership finally has certainty on revenue, spend, and project velocity every morning.',
    avatar: '👩‍💼',
  },
  {
    name: 'Michael Chen',
    role: 'CFO · Global Industries',
    quote:
      'Month-end close now takes hours instead of days. Automations surface edge cases before auditors ever ask about them.',
    avatar: '👨‍💼',
  },
  {
    name: 'Emily Rodriguez',
    role: 'Ops Director · LogiTech',
    quote:
      'Every site runs from the same playbook. Predictive dashboards help us intervene before supply chain risks materialize.',
    avatar: '👩‍💻',
  },
];

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <a href="#" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-xl font-bold">S</span>
          Syspro
        </a>
        <nav className="hidden gap-8 text-sm font-medium text-slate-300 lg:flex">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-white">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <button
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/40 hover:text-white"
            onClick={() => (window.location.href = '/access')}
          >
            Sign in
          </button>
          <button className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:shadow-xl">
            Request demo
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-slate-950">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_60%)]" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-slate-950 via-slate-950/10" />
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-28">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-sky-100">
              <Sparkles size={16} /> AI-native operator cloud
            </span>
            <div className="space-y-6">
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                Command every workflow with <span className="text-sky-300">intelligent operations</span>
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-300">
                Syspro fuses revenue, finance, supply chain, and workforce telemetry into a single decisioning layer. Automate handoffs, surface
                anomalies instantly, and keep operators and executives aligned in real time.
              </p>
            </div>
            <div className="flex flex-col items-start gap-4 sm:flex-row">
              <button
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-600/30 transition hover:shadow-xl"
                onClick={() => (window.location.href = '/access')}
              >
                Start free trial
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </button>
              <button className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white">
                <Play size={18} /> Watch 2-min demo
              </button>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <div className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 text-lg">4.9★</span>
                  <div>
                    <p className="font-semibold text-white">2,000+ enterprise reviews</p>
                    <p className="text-xs text-slate-400">Across manufacturing, energy, and logistics</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                  {marqueeLogos.slice(0, 3).map((logo) => (
                    <span key={logo} className="rounded-full border border-white/15 px-3 py-1 text-white/80">
                      {logo}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Outcomes</p>
                <div className="mt-4 space-y-4">
                  {heroStats.map((stat) => (
                    <div key={stat.label} className="flex items-center justify-between text-sm">
                      <span className="text-white/80">{stat.label}</span>
                      <span className="text-lg font-semibold text-white">{stat.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="relative w-full">
            <div className="absolute -left-12 top-10 h-44 w-44 rounded-full bg-indigo-500/30 blur-3xl" />
            <div className="relative overflow-hidden rounded-4xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-950 to-slate-950 shadow-[0_40px_120px_-40px_rgba(56,189,248,0.6)]">
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 text-sm text-white/80">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600">
                    <Shield className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-white">Global Control Plane</p>
                    <p className="text-xs text-white/60">Live signal · All sites in sync</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-2 text-xs text-emerald-300">
                  <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" /> Synced
                </span>
              </div>
              <div className="space-y-6 p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { label: 'Revenue YTD', value: '$874K', delta: '+23%' },
                    { label: 'Active contracts', value: '1,247', delta: '+12%' },
                  ].map((metric) => (
                    <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
                      <p className="text-xs uppercase tracking-[0.2em] text-white/60">{metric.label}</p>
                      <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
                      <p className="text-xs text-emerald-300">{metric.delta} vs last month</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/80">
                  <div className="mb-3 flex items-center justify-between text-white/60">
                    <span>Automation runway</span>
                    <span>12 workflows · 3 escalations</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Procurement refresh', icon: LineChart },
                      { label: 'HR compliance', icon: Briefcase },
                      { label: 'Order routing', icon: Globe2 },
                    ].map(({ label, icon: Icon }) => (
                      <span key={label} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-white/70">
                        <Icon className="h-3 w-3" /> {label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  {platformCallouts.map(({ icon: Icon, title, description }) => (
                    <div key={title} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-transparent px-3 py-2 text-sm text-white/80">
                      <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-white">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-medium text-white">{title}</p>
                        <p className="text-xs text-white/60">{description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Momentum() {
  return (
    <section className="relative overflow-hidden border-y border-white/10 bg-gradient-to-r from-sky-600/20 via-slate-950 to-indigo-900/40 py-16">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,_rgba(14,165,233,0.2),_transparent_65%)]" />
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {momentumMetrics.map((metric) => (
            <div key={metric.label} className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-lg shadow-sky-900/20 backdrop-blur">
              <p className="text-3xl font-bold">{metric.value}</p>
              <p className="mt-2 text-sm text-white/70">{metric.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Modules() {
  return (
    <section id="features" className="bg-slate-950 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-300">Platform pillars</span>
          <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">Compose modules, orchestrate every motion</h2>
          <p className="mt-3 text-base text-slate-300">
            A single operator cloud for revenue, finance, operations, and workforce teams. Pick the starting point that moves the needle most, then
            expand without switching context.
          </p>
        </div>
        <div className="mt-16 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {modules.map(({ icon: Icon, title, description, accent }) => (
            <div
              key={title}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_50px_-20px_rgba(59,130,246,0.4)] transition hover:-translate-y-1"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-white">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/70">{description}</p>
              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-sky-500/10 blur-2xl transition group-hover:scale-150" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Operations() {
  return (
    <section id="solutions" className="relative overflow-hidden bg-slate-950 py-20">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_bottom,_rgba(56,189,248,0.18),_transparent_65%)]" />
      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-6 lg:flex-row lg:items-center">
        <div className="relative w-full max-w-lg overflow-hidden rounded-4xl border border-white/10 bg-white/5 shadow-[0_30px_80px_-30px_rgba(56,189,248,0.35)]">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1552664730-d307ca884978?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwzfHxvcGVyYXRpb25zJTIwdGVhbXxlbnwxfHx8fDE3NzAxMjM4ODl8MA&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Operations team reviewing dashboards"
            className="h-full w-full object-cover"
          />
          <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/15 bg-slate-950/80 p-4 text-sm text-white shadow-lg">
            <p className="font-semibold">Command center in practice</p>
            <p className="text-white/70">Site telemetry, supplier health, and workforce coverage tracked from the same pane.</p>
          </div>
        </div>
        <div className="max-w-xl space-y-8">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">Why operators switch</span>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Telemetry-grade visibility, closed-loop execution</h2>
          <p className="text-base text-white/70">
            Syspro adapts to the cadence of complex supply chains. Every signal, approval, and forecast feeds the same automation fabric so nothing
            falls through the gaps.
          </p>
          <div className="space-y-6">
            {operationsHighlights.map(({ title, description, bullets }) => (
              <div key={title} className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white">
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-white/70">{description}</p>
                <ul className="mt-4 space-y-2 text-sm text-white/60">
                  {bullets.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-sky-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <button className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:border-white">
            Explore solution playbooks
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}

function SocialProof() {
  return (
    <section id="resources" className="bg-slate-950 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-300">Customer proof</span>
          <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">Trusted by operators across every region</h2>
          <p className="mt-3 text-sm text-white/70">
            Leaders in manufacturing, energy, logistics, and technology rely on Syspro to orchestrate growth without losing control.
          </p>
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div key={testimonial.name} className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_-30px_rgba(56,189,248,0.3)]">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/20 text-xl">{testimonial.avatar}</span>
                <div>
                  <p className="text-base font-semibold text-white">{testimonial.name}</p>
                  <p className="text-xs text-white/60">{testimonial.role}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-white/80">“{testimonial.quote}”</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="relative overflow-hidden border-y border-white/10 bg-gradient-to-br from-sky-600 via-slate-950 to-violet-900 py-20">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.35),_transparent_55%)]" />
      <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div className="space-y-6 text-white">
          <span className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">Get started</span>
          <h2 className="text-3xl font-bold sm:text-4xl lg:text-5xl">Ready to orchestrate Ops</h2>
          <p className="text-base text-white/70">
            Launch Syspro in under 72 hours with guided onboarding and dedicated success architects. Start with the modules you need and expand as
            your operations mature.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-slate-100">
              Start free trial
              <ArrowRight size={16} />
            </button>
            <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:border-white">
              Talk to sales
            </button>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-white/70">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1">
              <Check size={14} /> 30-day pilot program
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1">
              <Check size={14} /> SOC 2 Type II compliant
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1">
              <Check size={14} /> White-glove onboarding
            </span>
          </div>
        </div>
        <div className="relative hidden overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur lg:block">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1642522029691-029b5a432954?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBtZWV0aW5nfGVufDF8fHx8MTc3MDQ2Mzg0NHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
            alt="Executive workshop"
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const footerLinks = {
    product: ['Features', 'Pricing', 'Security', 'Integrations', 'Roadmap'],
    company: ['About', 'Careers', 'Press', 'Partners', 'Contact'],
    resources: ['Docs', 'Help center', 'Community', 'Webinars', 'Case studies'],
    legal: ['Privacy', 'Terms', 'GDPR', 'SOC 2', 'Accessibility'],
  };

  return (
    <footer className="bg-slate-950">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 text-xl font-bold">S</span>
              Syspro
            </div>
            <p className="text-sm leading-6 text-white/70">
              The AI-forward operator cloud helping revenue, finance, and supply teams orchestrate complex businesses with certainty.
            </p>
            <div className="space-y-2 text-sm text-white/60">
              <p>contact@syspro.com</p>
              <p>+1 (555) 123-4567</p>
              <p>San Francisco · London · Singapore</p>
            </div>
          </div>
          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group} className="space-y-3 text-sm">
              <h3 className="font-semibold text-white capitalize">{group}</h3>
              <ul className="space-y-2 text-white/60">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="transition hover:text-white">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Syspro. All rights reserved.</span>
          <div className="flex gap-5">
            {['LinkedIn', 'Twitter', 'YouTube'].map((network) => (
              <a key={network} href="#" className="transition hover:text-white">
                {network}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <div className="bg-slate-950 text-slate-100">
      <Header />
      <main id="main-content" className="isolate">
        <Hero />
        <Momentum />
        <Modules />
        <Operations />
        <SocialProof />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
