"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight, Building2, Banknote, Users, Layers3, FileText, Zap, Settings, Wallet, PieChart, ShieldCheck, ClipboardList, PlugZap } from "lucide-react";

export default function TenantAdminShell({ children }: { children: React.ReactNode }) {
  const modules = [
    { key: "overview", label: "Overview", icon: Building2 },
    { key: "crm", label: "CRM", icon: ClipboardList },
    { key: "finance", label: "Finance", icon: Banknote },
    { key: "projects", label: "Projects", icon: Layers3 },
    { key: "people", label: "Human Resources", icon: Users },
    { key: "procurement", label: "Procurement", icon: Wallet },
    { key: "automation", label: "Automation", icon: Zap },
    { key: "admin", label: "Admin Controls", icon: Settings },
    { key: "integrations", label: "Integrations", icon: PlugZap },
    { key: "reports", label: "Reports", icon: FileText },
    { key: "security", label: "Security", icon: ShieldCheck },
    { key: "billing", label: "Billing", icon: PieChart },
  ];

  function navigateTo(key: string) {
    try {
      // Set hash so pages that inspect location.hash can react
      window.location.hash = key;
    } catch (e) {
      // ignore in SSR or restricted envs
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-72 hidden md:flex flex-col border-r bg-white">
        <div className="px-4 py-6 border-b">
          <div className="font-semibold">Tenant Admin</div>
          <div className="text-xs text-slate-500">Modules</div>
        </div>
        <nav className="flex-1 overflow-auto p-3 space-y-2">
          {modules.map((m) => {
            const Icon = (m as any).icon || ChevronRight;
            return (
              <button
                key={m.key}
                onClick={() => navigateTo(m.key)}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1 text-left">{m.label}</span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t text-xs text-slate-500">Dev sidebar — anchors set on click</div>
      </aside>

      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
