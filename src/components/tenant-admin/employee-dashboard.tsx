"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck, Target, Receipt, Plane, Wallet, ClipboardList,
  TrendingUp, Users, DollarSign, FolderKanban, ShoppingCart,
  BarChart3, Zap, Settings, ArrowRight, Loader2, UserCircle,
  CheckCircle, Clock, ChevronDown, ChevronRight, ArrowLeft
} from "lucide-react";
import { useTenantPermissions } from "@/hooks/use-tenant-permissions";
import { AttendanceTab } from "@/app/employee/dashboard/tabs/AttendanceTab";
import { LeaveTab } from "@/app/employee/dashboard/tabs/LeaveTab";
import { ExpensesTab } from "@/app/employee/dashboard/tabs/ExpensesTab";
import { TasksTab } from "@/app/employee/dashboard/tabs/TasksTab";
import { PayslipsTab } from "@/app/employee/dashboard/tabs/PayslipsTab";

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

type SelfServiceTab = 'attendance' | 'tasks' | 'expenses' | 'leave' | 'payslips' | null;

export function EmployeeDashboard() {
  const perms = useTenantPermissions();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selfServiceOpen, setSelfServiceOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<SelfServiceTab>(null);

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
  const assignedModules = Object.entries(modulePerms)
    .filter(([, v]) => v === true)
    .map(([k]) => k)
    .filter((k) => k !== "self_service");
  const firstName = profile?.name?.split(" ")[0] || "there";
  const roleLabel = perms.roleId
    ? perms.roleId.charAt(0).toUpperCase() + perms.roleId.slice(1).toLowerCase()
    : "Team Member";

  const selfServiceItems: { key: SelfServiceTab; label: string; desc: string; icon: any; color: string }[] = [
    { key: 'attendance', label: "Attendance", desc: "Check In/Out", icon: CalendarCheck, color: "bg-blue-100 text-blue-600" },
    { key: 'tasks', label: "Tasks & KPIs", desc: "View Tasks", icon: Target, color: "bg-green-100 text-green-600" },
    { key: 'expenses', label: "Expenses", desc: "Submit", icon: Receipt, color: "bg-orange-100 text-orange-600" },
    { key: 'leave', label: "Leave", desc: "Request Leave", icon: Plane, color: "bg-cyan-100 text-cyan-600" },
    { key: 'payslips', label: "Payslips", desc: "View", icon: Wallet, color: "bg-purple-100 text-purple-600" },
  ];

  if (activeTab) {
    const activeItem = selfServiceItems.find(i => i.key === activeTab);
    return (
      <div className="space-y-6">
        <button
          onClick={() => setActiveTab(null)}
          className="inline-flex items-center gap-2 text-sm text-theme-text-secondary hover:text-theme-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeItem?.color}`}>
            {activeItem && <activeItem.icon className="w-5 h-5" />}
          </div>
          <h2 className="text-xl font-bold text-theme-text-primary">{activeItem?.label}</h2>
        </div>
        <div className="bg-white rounded-xl border border-gray-200">
          {activeTab === 'attendance' && <AttendanceTab />}
          {activeTab === 'tasks' && <TasksTab profile={profile} />}
          {activeTab === 'expenses' && <ExpensesTab profile={profile} />}
          {activeTab === 'leave' && <LeaveTab profile={profile} />}
          {activeTab === 'payslips' && <PayslipsTab profile={profile} />}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="rounded-xl bg-gradient-to-r from-theme-accent to-theme-primary p-6 text-white">
        <h1 className="text-2xl font-bold">Welcome, {firstName}</h1>
        <p className="text-sm opacity-90 mt-1">
          {roleLabel} {profile?.jobTitle ? `· ${profile.jobTitle}` : ""}
        </p>
      </div>

      {/* Assigned modules */}
      {assignedModules.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-theme-text-primary mb-3">Your Modules</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {assignedModules
              .filter((k) => MODULE_CARDS[k])
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

      {/* Self-Service section */}
      <div className="rounded-xl border border-theme-border bg-theme-surface overflow-hidden">
        <button
          onClick={() => setSelfServiceOpen(!selfServiceOpen)}
          className="w-full flex items-center justify-between p-4 hover:bg-theme-muted transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <UserCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-theme-text-primary">Self-Service</p>
              <p className="text-xs text-theme-text-secondary">Attendance, expenses, leave, payslips, tasks & profile</p>
            </div>
          </div>
          {selfServiceOpen ? (
            <ChevronDown className="w-5 h-5 text-theme-text-tertiary" />
          ) : (
            <ChevronRight className="w-5 h-5 text-theme-text-tertiary" />
          )}
        </button>
        {selfServiceOpen && (
          <div className="p-4 pt-0 grid grid-cols-2 md:grid-cols-3 gap-3">
            {selfServiceItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className="flex items-center gap-3 p-3 rounded-lg border border-theme-border hover:bg-theme-muted transition-colors text-left"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-theme-text-secondary">{item.label}</p>
                    <p className="text-sm font-medium text-theme-text-primary">{item.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
