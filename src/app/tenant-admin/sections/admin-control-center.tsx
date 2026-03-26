"use client";

import { BarChart3, Command, CreditCard, Layers3, PlugZap, Shield, ShieldCheck, Users, Wallet } from "lucide-react";

const SECTIONS = [
  {
    key: "people-access",
    title: "People & Access",
    icon: Users,
    summary: "Invite, role-map, and scope data access across regions, branches, and departments.",
    bullets: ["Bulk invites and acting roles", "Module + action permissions", "Data scopes: global to self"],
  },
  {
    key: "structure",
    title: "Structure",
    icon: Command,
    summary: "Shape the org: regions, branches, departments, teams, and matrix managers.",
    bullets: ["Drag-and-drop topology", "HOD / branch / regional leads", "Links to cost centers"],
  },
  {
    key: "modules",
    title: "Modules",
    icon: Layers3,
    summary: "Turn ERP areas on/off per tenant with sub-module flags and beta gates.",
    bullets: ["Module toggles and sub-modules", "Role-based access", "Sandbox / beta rollout"],
  },
  {
    key: "billing",
    title: "Billing",
    icon: CreditCard,
    summary: "Plans, seats, invoicing, payments, proration, and grace/downgrade rules.",
    bullets: ["User / module / usage plans", "Cards + bank + Stripe/Flutterwave", "Proration and grace periods"],
  },
  {
    key: "cost-allocation",
    title: "Cost Allocation",
    icon: Wallet,
    summary: "Enterprise-grade allocations to departments, branches, projects, and clients.",
    bullets: ["Even/headcount/revenue splits", "Link salaries/ops/software", "Versioned rules with previews"],
  },
  {
    key: "integrations",
    title: "Integrations",
    icon: PlugZap,
    summary: "Connect payments, accounting, comms, HR/payroll, and webhooks with mapping + retries.",
    bullets: ["OAuth/API keys and secrets", "Field mapping + sync cadence", "Error logs and retries"],
  },
  {
    key: "analytics",
    title: "Analytics (Meta)",
    icon: BarChart3,
    summary: "Adoption and system health: activity logs, usage heatmaps, device/login analytics.",
    bullets: ["Module/feature adoption", "Region/branch comparisons", "Export to CSV/BI"],
  },
  {
    key: "security",
    title: "Security",
    icon: ShieldCheck,
    summary: "MFA/SSO, IP/device controls, audit trails, data residency, backup/restore, compliance cues.",
    bullets: ["MFA + SSO (Google/Azure AD)", "IP allow/deny and device tracking", "Audit logs and residency"],
  },
];

export default function AdminControlCenter() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Admin</p>
        <h2 className="text-xl font-semibold text-slate-900">Tenant Control Center</h2>
        <p className="mt-1 text-sm text-slate-500">Calm, governed starting point for tenant owners, super admins, and global leads.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map((section) => (
          <div key={section.key} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-700">
                <section.icon className="h-5 w-5" />
                <span className="text-sm font-semibold text-slate-900">{section.title}</span>
              </div>
              <span className="rounded-full bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">Admin-only</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{section.summary}</p>
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              {section.bullets.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Shield className="mt-[3px] h-3.5 w-3.5 text-slate-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
