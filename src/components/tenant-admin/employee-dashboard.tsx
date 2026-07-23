"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck, Target, Receipt, Plane, Wallet,
  Users, DollarSign, FolderKanban, ShoppingCart,
  BarChart3, Zap, Settings, ArrowRight, Loader2, UserCircle,
  LayoutDashboard,
} from "lucide-react";
import { useTenantPermissions } from "@/hooks/use-tenant-permissions";
import { DashboardTab } from "@/app/employee/dashboard/tabs/DashboardTab";
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

type TopTab = 'dashboard' | 'self-service';
type SelfServiceSub = 'attendance' | 'tasks' | 'expenses' | 'leave' | 'payslips';

const SELF_SERVICE_SUBS: { key: SelfServiceSub; label: string; icon: any }[] = [
  { key: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { key: 'tasks', label: 'Tasks & KPIs', icon: Target },
  { key: 'expenses', label: 'Expenses', icon: Receipt },
  { key: 'leave', label: 'Leave', icon: Plane },
  { key: 'payslips', label: 'Payslips', icon: Wallet },
];

export function EmployeeDashboard() {
  const perms = useTenantPermissions();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [topTab, setTopTab] = useState<TopTab>('dashboard');
  const [selfSub, setSelfSub] = useState<SelfServiceSub>('attendance');

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

  const profileData = profile || { id: '', name: 'Employee', email: '', jobTitle: '', role: 'staff', departmentId: '', employmentType: '', status: 'active', hireDate: '', salary: 0 };

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="rounded-xl bg-gradient-to-r from-theme-accent to-theme-primary p-6 text-white">
        <h1 className="text-2xl font-bold">Welcome, {firstName}</h1>
        <p className="text-sm opacity-90 mt-1">
          {roleLabel} {profile?.jobTitle ? `· ${profile.jobTitle}` : ""}
        </p>
      </div>

      {/* Top-level tabs */}
      <div className="flex gap-1 border-b border-theme-border">
        <button
          onClick={() => setTopTab('dashboard')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            topTab === 'dashboard'
              ? 'border-theme-accent text-theme-accent'
              : 'border-transparent text-theme-text-secondary hover:text-theme-text-primary'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          Overview
        </button>
        <button
          onClick={() => setTopTab('self-service')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            topTab === 'self-service'
              ? 'border-theme-accent text-theme-accent'
              : 'border-transparent text-theme-text-secondary hover:text-theme-text-primary'
          }`}
        >
          <UserCircle className="w-4 h-4" />
          Self-Service
        </button>
      </div>

      {/* Overview tab content */}
      {topTab === 'dashboard' && (
        <div className="space-y-6">
          <DashboardTab
            profile={profileData}
            onNavigate={(tab) => {
              const subMap: Record<string, SelfServiceSub> = {
                attendance: 'attendance',
                tasks: 'tasks',
                expenses: 'expenses',
                leave: 'leave',
                reports: 'tasks',
                profile: 'payslips',
              };
              const sub = subMap[tab];
              if (sub) {
                setSelfSub(sub);
                setTopTab('self-service');
              }
            }}
          />

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
        </div>
      )}

      {/* Self-Service tab content */}
      {topTab === 'self-service' && (
        <div className="space-y-4">
          {/* Sub-tabs */}
          <div className="flex flex-wrap gap-1">
            {SELF_SERVICE_SUBS.map((sub) => {
              const Icon = sub.icon;
              return (
                <button
                  key={sub.key}
                  onClick={() => setSelfSub(sub.key)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    selfSub === sub.key
                      ? 'bg-theme-accent text-white'
                      : 'bg-theme-muted text-theme-text-secondary hover:text-theme-text-primary'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {sub.label}
                </button>
              );
            })}
          </div>

          {/* Active sub-tab content */}
          <div className="bg-white rounded-xl border border-gray-200">
            {selfSub === 'attendance' && <AttendanceTab />}
            {selfSub === 'tasks' && <TasksTab profile={profileData} />}
            {selfSub === 'expenses' && <ExpensesTab profile={profileData} />}
            {selfSub === 'leave' && <LeaveTab profile={profileData} />}
            {selfSub === 'payslips' && <PayslipsTab profile={profileData} />}
          </div>
        </div>
      )}
    </div>
  );
}
