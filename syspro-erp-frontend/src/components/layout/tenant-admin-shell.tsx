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
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
