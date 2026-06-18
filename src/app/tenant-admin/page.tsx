"use client";

import React, { useEffect, useState } from "react";
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
} from "lucide-react";
import Link from "next/link";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { DashboardSkeleton } from "@/components/ui/dashboard-skeleton";
import { EmptyState } from "@/components/ui/empty-state";

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

export default function TenantAdminDashboard() {
  const { tenantSlug } = useTenantContext();
  const [metrics, setMetrics] = useState<DashboardMetric[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug) return;
    loadDashboard();
  }, [tenantSlug]);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch finance dashboard snapshot
      const financeRes = await fetch(
        `/api/finance/dashboard?tenantSlug=${tenantSlug}&timeframe=last_30_days`
      );
      const financeData = financeRes.ok
        ? await financeRes.json()
        : { snapshot: null };

      const snap = financeData.snapshot || financeData;

      // Build metrics from finance data
      const financeMetrics: DashboardMetric[] = [];
      if (Array.isArray(snap.metrics) && snap.metrics.length > 0) {
        const m = snap.metrics;
        financeMetrics.push({
          label: m[0]?.label || "Total Revenue",
          value: m[0]?.value || "—",
          delta: m[0]?.delta,
          trend: m[0]?.trend,
          icon: <DollarSign className="w-5 h-5 text-[#6366F1]" />,
          iconBg: "bg-[rgba(99,102,241,0.1)]",
          href: "/tenant-admin/finance",
        });
        if (m[1]) {
          financeMetrics.push({
            label: m[1].label,
            value: m[1].value,
            delta: m[1].delta,
            trend: m[1].trend,
            icon: <Receipt className="w-5 h-5 text-[#EF4444]" />,
            iconBg: "bg-[rgba(239,68,68,0.1)]",
            href: "/tenant-admin/expenses",
          });
        }
        if (m[2]) {
          financeMetrics.push({
            label: m[2].label,
            value: m[2].value,
            delta: m[2].delta,
            trend: m[2].trend,
            icon: <CreditCard className="w-5 h-5 text-[#10B981]" />,
            iconBg: "bg-[rgba(16,185,129,0.1)]",
            href: "/tenant-admin/payments",
          });
        }
      } else {
        financeMetrics.push(
          {
            label: "Total Revenue",
            value: "—",
            icon: <DollarSign className="w-5 h-5 text-[#6366F1]" />,
            iconBg: "bg-[rgba(99,102,241,0.1)]",
            href: "/tenant-admin/finance",
          },
          {
            label: "Total Expenses",
            value: "—",
            icon: <Receipt className="w-5 h-5 text-[#EF4444]" />,
            iconBg: "bg-[rgba(239,68,68,0.1)]",
            href: "/tenant-admin/expenses",
          },
          {
            label: "Net Cash Flow",
            value: "—",
            icon: <CreditCard className="w-5 h-5 text-[#10B981]" />,
            iconBg: "bg-[rgba(16,185,129,0.1)]",
            href: "/tenant-admin/payments",
          }
        );
      }

      // Add user count metric
      let users = 0;
      try {
        const usersRes = await fetch(`/api/tenant/users?tenantSlug=${tenantSlug}`);
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          users = usersData.users?.length || 0;
        }
      } catch {
        // ignore
      }
      setUserCount(users);

      financeMetrics.push({
        label: "Team Members",
        value: String(users),
        icon: <Users className="w-5 h-5 text-[#818CF8]" />,
        iconBg: "bg-[rgba(129,140,248,0.1)]",
        href: "/tenant-admin/users",
      });

      setMetrics(financeMetrics);

      // Build recent transactions from receivables + payables
      const txns: Transaction[] = [];
      (snap.receivables || []).slice(0, 5).forEach((r: any) => {
        txns.push({
          id: `rec-${r.id}`,
          description: `Receivable: ${r.entity}`,
          amount: r.amount,
          type: "income",
          date: r.dueDate,
          status: r.status,
        });
      });
      (snap.payables || []).slice(0, 5).forEach((p: any) => {
        txns.push({
          id: `pay-${p.id}`,
          description: `Payable: ${p.entity}`,
          amount: p.amount,
          type: "expense",
          date: p.dueDate,
          status: p.status,
        });
      });
      setTransactions(
        txns.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        ).slice(0, 8)
      );
    } catch (err) {
      console.error("Dashboard load error:", err);
      setError("Failed to load dashboard data. Some information may be unavailable.");
    } finally {
      setLoading(false);
    }
  };

  const quickActions: QuickAction[] = [
    {
      label: "New Bill",
      href: "/tenant-admin/bills",
      icon: <Plus className="w-4 h-4" />,
    },
    {
      label: "Add Expense",
      href: "/tenant-admin/expenses",
      icon: <Plus className="w-4 h-4" />,
    },
    {
      label: "Create Invoice",
      href: "/tenant-admin/finance",
      icon: <Plus className="w-4 h-4" />,
    },
    {
      label: "Add Lead",
      href: "/tenant-admin/crm/leads",
      icon: <Plus className="w-4 h-4" />,
    },
  ];

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      current: "bg-green-500/10 text-green-400",
      due_soon: "bg-amber-500/10 text-amber-400",
      overdue: "bg-red-500/10 text-red-400",
      paid: "bg-green-500/10 text-green-400",
      pending: "bg-amber-500/10 text-amber-400",
    };
    return map[status] || "bg-[rgba(255,255,255,0.05)] text-[#94A3B8]";
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#F8FAFC]">Dashboard Overview</h1>
        <p className="text-[#94A3B8] mt-1">
          Welcome back! Here&apos;s your system at a glance.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <DashboardSkeleton cards={4} rows={6} />
      ) : (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((m) => (
              <Link
                key={m.label}
                href={m.href}
                className="group bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-5 hover:border-[rgba(99,102,241,0.3)] transition-colors"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-10 h-10 rounded-lg ${m.iconBg} flex items-center justify-center`}>
                    {m.icon}
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#64748B] group-hover:text-[#818CF8] transition-colors" />
                </div>
                <p className="text-sm text-[#94A3B8] mb-1">{m.label}</p>
                <p className="text-2xl font-bold text-[#F8FAFC]">{m.value}</p>
                {m.delta && (
                  <div className="flex items-center gap-1 mt-2">
                    {m.trend === "up" ? (
                      <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                    )}
                    <span
                      className={`text-xs font-medium ${
                        m.trend === "up" ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {m.delta}
                    </span>
                  </div>
                )}
              </Link>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-5">
            <h3 className="text-sm font-semibold text-[#F8FAFC] mb-4">Quick Actions</h3>
            <div className="flex flex-wrap gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[rgba(99,102,241,0.1)] border border-[rgba(99,102,241,0.2)] text-[#818CF8] rounded-lg hover:bg-[rgba(99,102,241,0.15)] text-sm font-medium transition-colors"
                >
                  {action.icon}
                  {action.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#F8FAFC]">
                Recent Transactions
              </h3>
              <Link
                href="/tenant-admin/finance"
                className="text-xs text-[#818CF8] hover:text-[#F8FAFC] transition-colors"
              >
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
                    <tr className="border-b border-[rgba(255,255,255,0.07)]">
                      <th className="text-left text-xs font-medium text-[#94A3B8] py-3 px-2">
                        Description
                      </th>
                      <th className="text-left text-xs font-medium text-[#94A3B8] py-3 px-2">
                        Type
                      </th>
                      <th className="text-left text-xs font-medium text-[#94A3B8] py-3 px-2">
                        Date
                      </th>
                      <th className="text-left text-xs font-medium text-[#94A3B8] py-3 px-2">
                        Status
                      </th>
                      <th className="text-right text-xs font-medium text-[#94A3B8] py-3 px-2">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(255,255,255,0.07)]">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                        <td className="py-3 px-2 text-sm text-[#F8FAFC]">
                          {tx.description}
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              tx.type === "income"
                                ? "bg-green-500/10 text-green-400"
                                : "bg-red-500/10 text-red-400"
                            }`}
                          >
                            {tx.type === "income" ? "Income" : "Expense"}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-sm text-[#94A3B8]">
                          {tx.date}
                        </td>
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusBadge(tx.status)}`}>
                            {tx.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-sm text-[#F8FAFC] text-right font-medium">
                          {tx.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
