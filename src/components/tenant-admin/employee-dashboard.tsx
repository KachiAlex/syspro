"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck, Target, Receipt, Plane, Wallet, ClipboardList,
  TrendingUp, Users, DollarSign, FolderKanban, ShoppingCart,
  BarChart3, Zap, Settings, ArrowRight, Loader2, UserCircle,
  CheckCircle, Clock
} from "lucide-react";
import { useTenantPermissions } from "@/hooks/use-tenant-permissions";

const MODULE_CARDS: Record<string, { label: string; href: string; icon: any; color: string }> = {
  crm: { label: "CRM", href: "/tenant-admin/crm", icon: Users, color: "from-blue-500 to-indigo-600" },
  finance: { label: "Finance", href: "/tenant-admin/finance", icon: DollarSign, color: "from-green-500 to-emerald-600" },
  people: { label: "HR & Operations", href: "/tenant-admin/hr", icon: UserCircle, color: "from-amber-500 to-orange-600" },
  projects: { label: "Projects", href: "/tenant-admin/projects", icon: FolderKanban, color: "from-purple-500 to-violet-600" },
  sales: { label: "Sales & Procurement", href: "/tenant-admin/sales", icon: ShoppingCart, color: "from-cyan-500 to-blue-600" },
  analytics: { label: "Reports & Analytics", href: "/tenant-admin/analytics", icon: BarChart3, color: "from-rose-500 to-pink-600" },
  automation: { label: "Automation", href: "/tenant-admin/automation", icon: Zap, color: "from-yellow-500 to-amber-600" },
  admin: { label: "Admin", href: "/tenant-admin/admin", icon: Settings, color: "from-gray-500 to-slate-600" },
};

export function EmployeeDashboard() {
  const perms = useTenantPermissions();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/hr/employees/me", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setProfile(data.employee);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  if (loading || perms.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-theme-accent animate-spin" />
      </div>
    );
  }

  const modulePerms = perms.employeeModules || {};
  const assignedModules = Object.entries(modulePerms).filter(([, v]) => v === true).map(([k]) => k);
  const firstName = profile?.name?.split(" ")[0] || "there";
  const roleLabel = perms.roleId
    ? perms.roleId.charAt(0).toUpperCase() + perms.roleId.slice(1).toLowerCase()
    : "Team Member";

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="rounded-xl bg-gradient-to-r from-theme-accent to-theme-primary p-6 text-white">
        <h1 className="text-2xl font-bold">Welcome, {firstName}</h1>
        <p className="text-sm opacity-90 mt-1">
          {roleLabel} {profile?.jobTitle ? `· ${profile.jobTitle}` : ""}
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/employee/dashboard" className="gradient-card bg-theme-surface rounded-xl border border-theme-border p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <CalendarCheck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-theme-text-secondary">Attendance</p>
              <p className="text-sm font-medium text-theme-text-primary">Check In/Out</p>
            </div>
          </div>
        </Link>
        <Link href="/employee/dashboard" className="gradient-card bg-theme-surface rounded-xl border border-theme-border p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Target className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-theme-text-secondary">Tasks & KPIs</p>
              <p className="text-sm font-medium text-theme-text-primary">View Tasks</p>
            </div>
          </div>
        </Link>
        <Link href="/employee/dashboard" className="gradient-card bg-theme-surface rounded-xl border border-theme-border p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-theme-text-secondary">Expenses</p>
              <p className="text-sm font-medium text-theme-text-primary">Submit</p>
            </div>
          </div>
        </Link>
        <Link href="/employee/dashboard" className="gradient-card bg-theme-surface rounded-xl border border-theme-border p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-theme-text-secondary">Payslips</p>
              <p className="text-sm font-medium text-theme-text-primary">View</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Assigned modules */}
      {assignedModules.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-theme-text-primary mb-3">Your Modules</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {assignedModules
              .filter((k) => k !== "self_service" && MODULE_CARDS[k])
              .map((key) => {
                const card = MODULE_CARDS[key];
                const Icon = card.icon;
                return (
                  <Link
                    key={key}
                    href={card.href}
                    className="group gradient-card bg-theme-surface rounded-xl border border-theme-border p-5 hover:shadow-lg transition-all hover:translate-y-[-2px]"
                  >
                    <div className="flex items-center justify-between">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <ArrowRight className="w-5 h-5 text-theme-text-tertiary group-hover:text-theme-accent group-hover:translate-x-1 transition-all" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-theme-text-primary">{card.label}</p>
                  </Link>
                );
              })}
          </div>
        </div>
      )}

      {/* Self-service link */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserCircle className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-900">Self-Service Portal</p>
              <p className="text-xs text-blue-700">Attendance, expenses, leave, payslips, tasks, and profile</p>
            </div>
          </div>
          <Link
            href="/employee/dashboard"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            Open <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
