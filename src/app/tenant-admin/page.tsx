"use client";

import React, { useEffect, useState } from "react";
import { useCallback } from "react";
import {
  DollarSign,
  Users,
  Receipt,
  CreditCard,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Plus,
  Loader2,
  AlertCircle,
  Target,
  FolderKanban,
  ShoppingCart,
  UserCheck,
  Calendar,
  Zap,
  BarChart3,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
} from "lucide-react";
import Link from "next/link";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { DashboardSkeleton } from "@/components/ui/dashboard-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useTenantPermissions } from "@/hooks/use-tenant-permissions";
import { EmployeeDashboard } from "@/components/tenant-admin/employee-dashboard";
import { AiInsightsCard } from "@/components/tenant-admin/ai-insights-card";
import { TrendChart } from "@/components/tenant-admin/trend-chart";
import { OnboardingChecklist } from "./components/onboarding-checklist";

interface DashboardMetric {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down";
  icon: React.ReactNode;
  iconBg: string;
  href: string;
}

interface QuickAction {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface Transaction {
  id: string;
  description: string;
  amount: string;
  type: "income" | "expense";
  date: string;
  status: string;
}

interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  type: "lead" | "deal" | "expense" | "bill" | "employee" | "leave" | "project";
  href: string;
}

export default function TenantAdminDashboard() {
  const { tenantSlug } = useTenantContext();
  const perms = useTenantPermissions();
  const [metrics, setMetrics] = useState<DashboardMetric[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [crmStats, setCrmStats] = useState<any>(null);
  const [hrStats, setHrStats] = useState<{ total: number; portalActive: number; onLeave: number }>({ total: 0, portalActive: 0, onLeave: 0 });
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [trend, setTrend] = useState<{ labels: string[]; revenue: number[]; expenses: number[] } | null>(null);
  const [opsItems, setOpsItems] = useState<Array<{ count: number; amount: number; label: string; href: string; severity: string }>>([]);
  const [posToday, setPosToday] = useState<{ posSales: number; posRevenue: number }>({ posSales: 0, posRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Role-based dashboard rendering:
  // - Admin role: full admin dashboard with all metrics
  // - Non-admin roles with module activations: employee dashboard with module cards
  const hasModuleRestrictions = Object.keys(perms.employeeModules || {}).length > 0;
  const showEmployeeDashboard = !perms.isAdmin && hasModuleRestrictions;



  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    const slug = encodeURIComponent(tenantSlug!);

    // Determine which modules the user can access
    const canFinance = perms.isAdmin || perms.finance !== 'none' || perms.employeeModules.finance === true;
    const canCRM = perms.isAdmin || perms.crm !== 'none' || perms.employeeModules.crm === true;
    const canHR = perms.isAdmin || perms.people !== 'none' || perms.employeeModules.people === true;

    try {
      const [financeRes, crmRes, empRes, leaveRes, opsRes] = await Promise.allSettled([
        canFinance ? fetch(`/api/finance/dashboard?tenantSlug=${slug}&timeframe=last_30_days`).then(r => r.ok ? r.json() : null) : Promise.resolve(null),
        canCRM ? fetch(`/api/crm/dashboard?tenantSlug=${slug}`).then(r => r.ok ? r.json() : null) : Promise.resolve(null),
        canHR ? fetch(`/api/hr/employees?tenantSlug=${slug}&limit=500`, { cache: "no-store" }).then(r => r.ok ? r.json() : null) : Promise.resolve(null),
        canHR ? fetch(`/api/hr/leave?tenantSlug=${slug}&status=pending`, { cache: "no-store" }).then(r => r.ok ? r.json() : null) : Promise.resolve(null),
        fetch(`/api/dashboard/ops?tenantSlug=${slug}`, { cache: "no-store" }).then(r => r.ok ? r.json() : null),
      ]);

      const opsData = opsRes.status === "fulfilled" ? opsRes.value : null;
      if (opsData) {
        setOpsItems(opsData.items ?? []);
        setPosToday(opsData.today ?? { posSales: 0, posRevenue: 0 });
      }

      // Process finance data
      const financeData = financeRes.status === "fulfilled" ? financeRes.value : null;
      const snap = financeData?.snapshot || financeData || {};
      if (snap.trend?.labels?.length >= 2) setTrend(snap.trend); else setTrend(null);
      const financeMetrics: DashboardMetric[] = [];

      if (Array.isArray(snap.metrics) && snap.metrics.length > 0) {
        const m = snap.metrics;
        financeMetrics.push({
          label: m[0]?.label || "Total Revenue",
          value: m[0]?.value || "—",
          delta: m[0]?.delta,
          trend: m[0]?.trend,
          icon: <DollarSign className="w-5 h-5 text-white" />,
          iconBg: "bg-gradient-to-br from-indigo-500 to-violet-600",
          href: "/tenant-admin/finance",
        });
        if (m[1]) {
          financeMetrics.push({
            label: m[1].label,
            value: m[1].value,
            delta: m[1].delta,
            trend: m[1].trend,
            icon: <Receipt className="w-5 h-5 text-white" />,
            iconBg: "bg-gradient-to-br from-rose-500 to-orange-500",
            href: "/tenant-admin/expenses",
          });
        }
        if (m[2]) {
          financeMetrics.push({
            label: m[2].label,
            value: m[2].value,
            delta: m[2].delta,
            trend: m[2].trend,
            icon: <CreditCard className="w-5 h-5 text-white" />,
            iconBg: "bg-gradient-to-br from-emerald-500 to-teal-500",
            href: "/tenant-admin/payments",
          });
        }
      } else {
        financeMetrics.push(
          {
            label: "Total Revenue",
            value: "—",
            icon: <DollarSign className="w-5 h-5 text-white" />,
            iconBg: "bg-gradient-to-br from-indigo-500 to-violet-600",
            href: "/tenant-admin/finance",
          },
          {
            label: "Total Expenses",
            value: "—",
            icon: <Receipt className="w-5 h-5 text-white" />,
            iconBg: "bg-gradient-to-br from-rose-500 to-orange-500",
            href: "/tenant-admin/expenses",
          },
          {
            label: "Net Cash Flow",
            value: "—",
            icon: <CreditCard className="w-5 h-5 text-white" />,
            iconBg: "bg-gradient-to-br from-emerald-500 to-teal-500",
            href: "/tenant-admin/payments",
          }
        );
      }

      // Process CRM data
      const crmData = crmRes.status === "fulfilled" ? crmRes.value : null;
      const crmPayload = crmData?.payload || crmData || null;
      if (crmPayload) {
        setCrmStats(crmPayload);
        const totals = crmPayload.totals || {};
        financeMetrics.push({
          label: "Open Deals",
          value: String(totals.opportunities || crmPayload.metrics?.find((m: any) => m.label === "Total Deals")?.value || 0),
          icon: <Target className="w-5 h-5 text-white" />,
          iconBg: "bg-gradient-to-br from-blue-500 to-cyan-600",
          href: "/tenant-admin/crm/pipeline",
        });
        if (Array.isArray(crmPayload.leads)) {
          setRecentLeads(crmPayload.leads.slice(0, 5));
        }
      } else {
        financeMetrics.push({
          label: "Open Deals",
          value: "0",
          icon: <Target className="w-5 h-5 text-white" />,
          iconBg: "bg-gradient-to-br from-blue-500 to-cyan-600",
          href: "/tenant-admin/crm/pipeline",
        });
      }

      // Process HR data
      const empData = empRes.status === "fulfilled" ? empRes.value : null;
      const employees = empData?.employees || [];
      const totalEmp = empData?.total || employees.length;
      const portalActive = employees.filter((e: any) => e.isPortalActive).length;
      const onLeave = employees.filter((e: any) => e.status === "on-leave" || e.status === "On Leave").length;
      setHrStats({ total: totalEmp, portalActive, onLeave });

      financeMetrics.push({
        label: "Team Members",
        value: String(totalEmp),
        icon: <Users className="w-5 h-5 text-white" />,
        iconBg: "bg-gradient-to-br from-violet-500 to-fuchsia-500",
        href: "/tenant-admin/hr/staff",
      });

      setMetrics(financeMetrics);

      // Build recent transactions
      const txns: Transaction[] = [];
      (snap.receivables || []).slice(0, 5).forEach((r: any) => {
        txns.push({ id: `rec-${r.id}`, description: `Receivable: ${r.entity}`, amount: r.amount, type: "income", date: r.dueDate, status: r.status || "pending" });
      });
      (snap.payables || []).slice(0, 5).forEach((p: any) => {
        txns.push({ id: `pay-${p.id}`, description: `Payable: ${p.entity}`, amount: p.amount, type: "expense", date: p.dueDate, status: p.status || "pending" });
      });
      setTransactions(txns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8));

      // Process leave requests
      const leaveData = leaveRes.status === "fulfilled" ? leaveRes.value : null;
      const leaves = leaveData?.requests || leaveData?.leaves || [];
      setPendingLeaves(leaves.slice(0, 5));

      // Build activity feed
      const activityItems: ActivityItem[] = [];
      if (Array.isArray(crmPayload?.leads)) {
        crmPayload.leads.slice(0, 3).forEach((lead: any) => {
          activityItems.push({
            id: `lead-${lead.id}`,
            title: `New lead: ${lead.companyName || lead.contactName}`,
            subtitle: `Stage: ${lead.stage}`,
            time: lead.createdAt || lead.updatedAt || "",
            type: "lead",
            href: "/tenant-admin/crm/leads",
          });
        });
        const deals = crmPayload.leads.filter((l: any) => l.stage === "qualified" || l.stage === "proposal");
        deals.slice(0, 2).forEach((deal: any) => {
          activityItems.push({
            id: `deal-${deal.id}`,
            title: `Deal progressed: ${deal.companyName}`,
            subtitle: `Moved to ${deal.stage}`,
            time: deal.updatedAt || "",
            type: "deal",
            href: "/tenant-admin/crm/pipeline",
          });
        });
      }
      employees.slice(0, 3).forEach((emp: any) => {
        if (emp.isPortalActive) {
          activityItems.push({
            id: `emp-${emp.id}`,
            title: `Portal activated: ${emp.name}`,
            subtitle: emp.jobTitle || emp.email,
            time: emp.updatedAt || emp.hireDate || "",
            type: "employee",
            href: "/tenant-admin/users",
          });
        }
      });
      leaves.slice(0, 3).forEach((leave: any) => {
        activityItems.push({
          id: `leave-${leave.id}`,
          title: `Leave request: ${leave.employeeName || leave.name || "Employee"}`,
          subtitle: `${leave.type || "Annual"} leave — ${leave.startDate || ""} to ${leave.endDate || ""}`,
          time: leave.createdAt || leave.requestedAt || "",
          type: "leave",
          href: "/tenant-admin/hr/attendance",
        });
      });

      activityItems.sort((a, b) => {
        const ta = a.time ? new Date(a.time).getTime() : 0;
        const tb = b.time ? new Date(b.time).getTime() : 0;
        return tb - ta;
      });
      setActivities(activityItems.slice(0, 10));
    } catch (err) {
      console.error("Dashboard load error:", err);
      setError("Failed to load dashboard data. Some information may be unavailable.");
    } finally {
      setLoading(false);
    }
  }, [perms, tenantSlug]);

  useEffect(() => {
    if (!tenantSlug || perms.loading) return;
    if (showEmployeeDashboard) return;
    loadDashboard();
  }, [loadDashboard, perms.loading, showEmployeeDashboard, tenantSlug]);

  const quickActions: QuickAction[] = [
    ...(perms.isAdmin || perms.finance !== 'none' || perms.employeeModules.finance === true ? [
      { label: "New Bill", href: "/tenant-admin/bills", icon: <Plus className="w-4 h-4" /> },
      { label: "Add Expense", href: "/tenant-admin/expenses", icon: <Plus className="w-4 h-4" /> },
      { label: "Create Invoice", href: "/tenant-admin/finance", icon: <Plus className="w-4 h-4" /> },
    ] : []),
    ...(perms.isAdmin || perms.crm !== 'none' || perms.employeeModules.crm === true ? [
      { label: "Add Lead", href: "/tenant-admin/crm/leads", icon: <Plus className="w-4 h-4" /> },
    ] : []),
    ...(perms.isAdmin || perms.people !== 'none' || perms.employeeModules.people === true ? [
      { label: "Add Employee", href: "/tenant-admin/hr/staff", icon: <Plus className="w-4 h-4" /> },
    ] : []),
    ...(perms.isAdmin || perms.projects !== 'none' || perms.employeeModules.projects === true ? [
      { label: "New Project", href: "/tenant-admin/projects", icon: <Plus className="w-4 h-4" /> },
    ] : []),
  ];

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      current: "bg-green-500/10 text-green-400",
      due_soon: "bg-amber-500/10 text-amber-400",
      overdue: "bg-red-500/10 text-red-400",
      paid: "bg-green-500/10 text-green-400",
      pending: "bg-amber-500/10 text-amber-400",
      approved: "bg-green-500/10 text-green-400",
      rejected: "bg-red-500/10 text-red-400",
    };
    return map[status] || "bg-[rgba(255,255,255,0.05)] text-theme-text-secondary";
  };

  const activityIcon = (type: string) => {
    const map: Record<string, { icon: React.ReactNode; bg: string }> = {
      lead: { icon: <Target className="w-4 h-4 text-white" />, bg: "bg-blue-500" },
      deal: { icon: <DollarSign className="w-4 h-4 text-white" />, bg: "bg-green-500" },
      expense: { icon: <Receipt className="w-4 h-4 text-white" />, bg: "bg-orange-500" },
      bill: { icon: <FileText className="w-4 h-4 text-white" />, bg: "bg-purple-500" },
      employee: { icon: <UserCheck className="w-4 h-4 text-white" />, bg: "bg-violet-500" },
      leave: { icon: <Calendar className="w-4 h-4 text-white" />, bg: "bg-amber-500" },
      project: { icon: <FolderKanban className="w-4 h-4 text-white" />, bg: "bg-cyan-500" },
    };
    return map[type] || { icon: <Activity className="w-4 h-4 text-white" />, bg: "bg-theme-muted" };
  };

  const formatTime = (time: string) => {
    if (!time) return "";
    const d = new Date(time);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    const mins = Math.floor(diff / (1000 * 60));
    if (mins > 0) return `${mins}m ago`;
    return "just now";
  };

  if (perms.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-theme-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (showEmployeeDashboard) {
    return <EmployeeDashboard />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold brand-gradient-text">Dashboard Overview</h1>
        <p className="text-theme-text-secondary mt-1">
          Welcome back! Here&apos;s your system at a glance.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <OnboardingChecklist />

      {loading ? (
        <DashboardSkeleton cards={4} rows={6} />
      ) : (
        <>
          {/* Primary Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {metrics.map((m) => (
              <Link
                key={m.label}
                href={m.href}
                className="group gradient-card bg-theme-surface rounded-lg border border-theme-border px-3 py-3 hover:border-theme-accent/40 transition-all duration-200 accent-glow hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg ${m.iconBg} flex items-center justify-center shrink-0`}>
                      {m.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-theme-text-secondary truncate">{m.label}</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-lg font-bold text-theme-text-primary leading-tight">{m.value}</p>
                        {m.delta && (
                          <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${m.trend === "up" ? "text-green-500" : "text-red-500"}`}>
                            {m.trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {m.delta}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 shrink-0 text-theme-text-tertiary group-hover:text-theme-accent transition-colors" />
                </div>
              </Link>
            ))}
          </div>

          {/* Needs Attention — operational action queue */}
          {opsItems.filter((i) => i.severity === "warn" && i.count > 0).length > 0 && (
            <div className="gradient-card bg-theme-surface rounded-xl border border-amber-500/25 p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-theme-text-primary">Needs attention</h3>
              </div>
              <div className="flex flex-wrap gap-3">
                {opsItems.filter((i) => i.severity === "warn" && i.count > 0).map((i) => (
                  <Link
                    key={i.label}
                    href={i.href}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-amber-500/25 bg-amber-500/5 hover:border-amber-500/50 transition-colors"
                  >
                    <span className="text-base font-bold text-amber-400">{i.count}</span>
                    <span className="text-xs text-theme-text-secondary">
                      {i.label}
                      {i.amount > 0 && <span className="text-theme-text-tertiary"> — ₦{i.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Secondary Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {(perms.isAdmin || perms.crm !== 'none' || perms.employeeModules.crm === true) && (
              <Link href="/tenant-admin/crm/leads" className="gradient-card bg-theme-surface rounded-lg border border-theme-border p-4 hover:border-theme-accent/30 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-theme-text-secondary">Leads</span>
                </div>
                <p className="text-xl font-bold text-theme-text-primary">{crmStats?.totals?.totalLeads || 0}</p>
              </Link>
            )}
            {(perms.isAdmin || perms.crm !== 'none' || perms.employeeModules.crm === true) && (
              <Link href="/tenant-admin/crm/customers" className="gradient-card bg-theme-surface rounded-lg border border-theme-border p-4 hover:border-theme-accent/30 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-theme-text-secondary">Customers</span>
                </div>
                <p className="text-xl font-bold text-theme-text-primary">{crmStats?.totals?.totalCustomers || 0}</p>
              </Link>
            )}
            {(perms.isAdmin || perms.people !== 'none' || perms.employeeModules.people === true) && (
              <Link href="/tenant-admin/users" className="gradient-card bg-theme-surface rounded-lg border border-theme-border p-4 hover:border-theme-accent/30 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-violet-400" />
                  <span className="text-xs text-theme-text-secondary">Portal Users</span>
                </div>
                <p className="text-xl font-bold text-theme-text-primary">{hrStats.portalActive}</p>
              </Link>
            )}
            {(perms.isAdmin || perms.people !== 'none' || perms.employeeModules.people === true) && (
              <Link href="/tenant-admin/hr/attendance" className="gradient-card bg-theme-surface rounded-lg border border-theme-border p-4 hover:border-theme-accent/30 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-theme-text-secondary">On Leave</span>
                </div>
                <p className="text-xl font-bold text-theme-text-primary">{hrStats.onLeave}</p>
              </Link>
            )}
            {(perms.isAdmin || perms.crm !== 'none' || perms.employeeModules.crm === true) && (
              <Link href="/tenant-admin/crm/pipeline" className="gradient-card bg-theme-surface rounded-lg border border-theme-border p-4 hover:border-theme-accent/30 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-theme-text-secondary">Deals Won</span>
                </div>
                <p className="text-xl font-bold text-theme-text-primary">{crmStats?.totals?.dealsWon || 0}</p>
              </Link>
            )}
            {(perms.isAdmin || perms.sales !== 'none' || perms.employeeModules.sales === true) && (
              <Link href="/tenant-admin/pos" className="gradient-card bg-theme-surface rounded-lg border border-theme-border p-4 hover:border-theme-accent/30 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingCart className="w-4 h-4 text-teal-400" />
                  <span className="text-xs text-theme-text-secondary">POS Today</span>
                </div>
                <p className="text-xl font-bold text-theme-text-primary">{posToday.posSales}</p>
                <p className="text-[10px] text-theme-text-tertiary mt-0.5">₦{posToday.posRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </Link>
            )}
            {(perms.isAdmin || perms.analytics !== 'none' || perms.employeeModules.analytics === true) && (
              <Link href="/tenant-admin/analytics" className="gradient-card bg-theme-surface rounded-lg border border-theme-border p-4 hover:border-theme-accent/30 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-rose-400" />
                  <span className="text-xs text-theme-text-secondary">Conversion</span>
                </div>
                <p className="text-xl font-bold text-theme-text-primary">{crmStats?.totals?.conversionRate?.toFixed(1) || 0}%</p>
              </Link>
            )}
          </div>

          {/* Revenue vs Expenses trend — data already returned by the finance
              dashboard snapshot but previously never rendered */}
          {trend && (perms.isAdmin || perms.finance !== 'none' || perms.employeeModules.finance === true) && (
            <div className="gradient-card bg-theme-surface rounded-xl border border-theme-border p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-theme-text-primary">Revenue vs Expenses — last 30 days</h3>
                <Link href="/tenant-admin/finance" className="text-xs text-theme-accent hover:text-theme-text-primary transition-colors">
                  Finance reports
                </Link>
              </div>
              <TrendChart labels={trend.labels} revenue={trend.revenue} expenses={trend.expenses} />
            </div>
          )}

          {/* AI Insights */}
          <AiInsightsCard />

          {/* Quick Actions */}
          <div className="gradient-card bg-theme-surface rounded-xl border border-theme-border p-5">
            <h3 className="text-sm font-semibold text-theme-text-primary mb-4">Quick Actions</h3>
            <div className="flex flex-wrap gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="inline-flex items-center gap-2 px-4 py-2 brand-gradient-subtle border border-theme-accent/30 text-theme-accent rounded-lg hover:border-theme-accent/60 text-sm font-medium transition-colors"
                >
                  {action.icon}
                  {action.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Main Content Grid: Recent Activity + Pending Approvals */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Activity Feed */}
            <div className="lg:col-span-2 gradient-card bg-theme-surface rounded-xl border border-theme-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-theme-text-primary">Recent Activity</h3>
                <Link href="/tenant-admin/audit" className="text-xs text-theme-accent hover:text-theme-text-primary transition-colors">
                  View audit trail
                </Link>
              </div>
              {activities.length === 0 ? (
                <EmptyState
                  title="No recent activity"
                  description="Activity from CRM, HR, and finance will appear here as your team uses the system."
                />
              ) : (
                <div className="space-y-3">
                  {activities.map((item) => {
                    const { icon, bg } = activityIcon(item.type);
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-theme-muted transition-colors group"
                      >
                        <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                          {icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-theme-text-primary truncate group-hover:text-theme-accent transition-colors">
                            {item.title}
                          </p>
                          <p className="text-xs text-theme-text-secondary truncate">{item.subtitle}</p>
                        </div>
                        <span className="text-xs text-theme-text-tertiary flex-shrink-0">{formatTime(item.time)}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pending Approvals */}
            {(perms.isAdmin || perms.people !== 'none' || perms.employeeModules.people === true) && (
            <div className="gradient-card bg-theme-surface rounded-xl border border-theme-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-theme-text-primary">Pending Approvals</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium">
                  {pendingLeaves.length} pending
                </span>
              </div>
              {pendingLeaves.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <p className="text-sm text-theme-text-secondary">All caught up!</p>
                  <p className="text-xs text-theme-text-tertiary mt-1">No pending approvals</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingLeaves.map((leave) => (
                    <Link
                      key={leave.id}
                      href="/tenant-admin/hr/attendance"
                      className="block p-3 rounded-lg border border-theme-border hover:border-theme-accent/30 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-theme-text-primary">{leave.employeeName || leave.name || "Employee"}</p>
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <p className="text-xs text-theme-text-secondary">{leave.type || "Annual"} leave</p>
                      <p className="text-xs text-theme-text-tertiary mt-1">
                        {leave.startDate ? new Date(leave.startDate).toLocaleDateString() : ""} — {leave.endDate ? new Date(leave.endDate).toLocaleDateString() : ""}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            )}

          </div>

          {/* Recent Transactions */}
          {(perms.isAdmin || perms.finance !== 'none' || perms.employeeModules.finance === true) && (
          <div className="gradient-card bg-theme-surface rounded-xl border border-theme-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-theme-text-primary">Recent Transactions</h3>
              <Link href="/tenant-admin/finance" className="text-xs text-theme-accent hover:text-theme-text-primary transition-colors">
                View all
              </Link>
            </div>
            {transactions.length === 0 ? (
              <EmptyState
                title="No recent transactions"
                description="Financial activity will appear here once you record bills, payments, or expenses."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-theme-border">
                      <th className="text-left text-xs font-medium text-theme-text-secondary py-3 px-2">Description</th>
                      <th className="text-left text-xs font-medium text-theme-text-secondary py-3 px-2">Type</th>
                      <th className="text-left text-xs font-medium text-theme-text-secondary py-3 px-2">Date</th>
                      <th className="text-left text-xs font-medium text-theme-text-secondary py-3 px-2">Status</th>
                      <th className="text-right text-xs font-medium text-theme-text-secondary py-3 px-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-border">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-theme-surface/5 transition-colors">
                        <td className="py-3 px-2 text-sm text-theme-text-primary">{tx.description}</td>
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${tx.type === "income" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                            {tx.type === "income" ? "Income" : "Expense"}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-sm text-theme-text-secondary">{tx.date}</td>
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusBadge(tx.status)}`}>
                            {(tx.status || "pending").replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-sm text-theme-text-primary text-right font-medium">{tx.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}

          {/* Recent Leads */}
          {recentLeads.length > 0 && (perms.isAdmin || perms.crm !== 'none' || perms.employeeModules.crm === true) && (
            <div className="gradient-card bg-theme-surface rounded-xl border border-theme-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-theme-text-primary">Recent Leads</h3>
                <Link href="/tenant-admin/crm/leads" className="text-xs text-theme-accent hover:text-theme-text-primary transition-colors">
                  View all
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-theme-border">
                      <th className="text-left text-xs font-medium text-theme-text-secondary py-3 px-2">Company</th>
                      <th className="text-left text-xs font-medium text-theme-text-secondary py-3 px-2">Contact</th>
                      <th className="text-left text-xs font-medium text-theme-text-secondary py-3 px-2">Stage</th>
                      <th className="text-left text-xs font-medium text-theme-text-secondary py-3 px-2">Source</th>
                      <th className="text-right text-xs font-medium text-theme-text-secondary py-3 px-2">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-border">
                    {recentLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-theme-surface/5 transition-colors">
                        <td className="py-3 px-2 text-sm font-medium text-theme-text-primary">{lead.companyName}</td>
                        <td className="py-3 px-2 text-sm text-theme-text-secondary">{lead.contactName}</td>
                        <td className="py-3 px-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 capitalize">
                            {lead.stage?.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-sm text-theme-text-secondary capitalize">{lead.source}</td>
                        <td className="py-3 px-2 text-sm text-theme-text-primary text-right font-medium">
                          {lead.expectedValue ? `${lead.currency || "$"}${Number(lead.expectedValue).toLocaleString()}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
