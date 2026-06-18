"use client";

import React, { useState, useEffect } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart,
  Calendar,
  ArrowRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

interface DashboardMetric {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down";
  description: string;
}

interface ScheduleItem {
  id: string;
  entity: string;
  amount: string;
  dueDate: string;
  status: "current" | "due_soon" | "overdue";
  branch: string;
}

interface ExpenseBreakdownItem {
  label: string;
  amount: string;
  delta: string;
  direction: "up" | "down";
}

interface DashboardData {
  metrics: DashboardMetric[];
  receivables: ScheduleItem[];
  payables: ScheduleItem[];
  expenseBreakdown: ExpenseBreakdownItem[];
}

const periodToTimeframe: Record<string, string> = {
  month: "last_30_days",
  quarter: "quarter_to_date",
  year: "quarter_to_date",
};

const categoryColors = [
  "bg-[#6366F1]",
  "bg-[#10B981]",
  "bg-[#F59E0B]",
  "bg-[#818CF8]",
  "bg-[#EF4444]",
  "bg-[#14B8A6]",
  "bg-[#FCD34D]",
  "bg-[#6366F1]",
];

export default function FinanceDashboard() {
  const { tenantSlug } = useTenantContext();
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    if (!tenantSlug) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        tenantSlug,
        timeframe: periodToTimeframe[period] || "last_30_days",
      });
      const response = await fetch(`/api/finance/dashboard?${params}`);
      if (!response.ok) throw new Error("Failed to load dashboard data");
      const result = await response.json();
      setData(result.snapshot || result);
    } catch (err) {
      console.error("Dashboard load error:", err);
      setError("Failed to load financial data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantSlug) loadDashboard();
  }, [tenantSlug, period]);

  const metrics = Array.isArray(data?.metrics) ? data.metrics : [];

  // Combine receivables (income) and payables (expense) as recent transactions
  const recentTransactions = React.useMemo(() => {
    const items: {
      id: string;
      description: string;
      amountStr: string;
      type: "income" | "expense";
      date: string;
      status: string;
    }[] = [];

    (data?.receivables ?? []).slice(0, 6).forEach((r) => {
      items.push({
        id: `rec-${r.id}`,
        description: `Receivable: ${r.entity}`,
        amountStr: r.amount,
        type: "income",
        date: r.dueDate,
        status: r.status,
      });
    });

    (data?.payables ?? []).slice(0, 6).forEach((p) => {
      items.push({
        id: `pay-${p.id}`,
        description: `Payable: ${p.entity}`,
        amountStr: p.amount,
        type: "expense",
        date: p.dueDate,
        status: p.status,
      });
    });

    return items.slice(0, 10);
  }, [data]);

  const expenseBreakdown = data?.expenseBreakdown ?? [];

  const iconForMetric = (label: string) => {
    if (label.toLowerCase().includes("revenue")) return <TrendingUp className="h-6 w-6 text-[#10B981]" />;
    if (label.toLowerCase().includes("burn") || label.toLowerCase().includes("expense")) return <TrendingDown className="h-6 w-6 text-[#EF4444]" />;
    if (label.toLowerCase().includes("cash")) return <DollarSign className="h-6 w-6 text-[#6366F1]" />;
    return <PieChart className="h-6 w-6 text-[#818CF8]" />;
  };

  const statusBadge = (status: string) => {
    const classes: Record<string, string> = {
      current: "bg-[rgba(16,185,129,.12)] text-[#10B981]",
      due_soon: "bg-[rgba(245,158,11,.12)] text-[#F59E0B]",
      overdue: "bg-[rgba(239,68,68,.12)] text-[#EF4444]",
    };
    return classes[status] || "bg-[rgba(255,255,255,.04)] text-[#94A3B8]";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#6366F1]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#F8FAFC] font-jakarta">Finance Dashboard</h1>
          <p className="text-[#94A3B8] mt-2 font-jakarta">
            Overview of your financial performance and recent transactions
          </p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-4 py-2 border border-[rgba(255,255,255,0.07)] rounded-[10px] text-sm font-medium text-[#F8FAFC] bg-[#111827] hover:bg-[#1A2438] focus:outline-none focus:border-[rgba(99,102,241,.4)] focus:shadow-[0_0_0_3px_rgba(99,102,241,.08)] cursor-pointer"
        >
          <option value="month" className="bg-[#1A2438] text-[#F8FAFC]">This Month</option>
          <option value="quarter" className="bg-[#1A2438] text-[#F8FAFC]">This Quarter</option>
          <option value="year" className="bg-[#1A2438] text-[#F8FAFC]">This Year</option>
        </select>
      </div>

      {error && (
        <div className="bg-[rgba(239,68,68,.08)] border border-[rgba(239,68,68,.2)] text-[#EF4444] px-4 py-3 rounded-[10px]">
          {error}
          <button onClick={loadDashboard} className="ml-4 underline text-sm">Retry</button>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="bg-[#1A2438] rounded-[14px] p-6 border border-[rgba(255,255,255,0.07)] transition-all hover:-translate-y-[1px]"
            style={{ boxShadow: '0 4px 14px rgba(0,0,0,.2)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-[#94A3B8] font-jakarta">{metric.label}</h3>
              {iconForMetric(metric.label)}
            </div>
            <div>
              <div className="text-2xl font-bold text-[#F8FAFC] font-jakarta">{metric.value}</div>
              <div
                className={`text-sm mt-2 flex items-center gap-1 font-jakarta ${
                  metric.trend === "up" ? "text-[#10B981]" : "text-[#EF4444]"
                }`}
              >
                {metric.trend === "up" ? "↑" : "↓"}
                <span>{metric.delta}</span>
                <span className="text-[#64748B] ml-1">{metric.description}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="lg:col-span-2 bg-[#1A2438] rounded-[14px] border border-[rgba(255,255,255,0.07)]" style={{ boxShadow: '0 4px 14px rgba(0,0,0,.2)' }}>
          <div className="p-6 border-b border-[rgba(255,255,255,0.07)]">
            <h2 className="text-lg font-semibold text-[#F8FAFC] flex items-center gap-2 font-jakarta">
              <Calendar className="h-5 w-5 text-[#94A3B8]" />
              Receivables & Payables
            </h2>
          </div>
          <div className="divide-y divide-[rgba(255,255,255,0.07)]">
            {recentTransactions.length === 0 && (
              <div className="p-8 text-center text-[#64748B]">No recent transactions</div>
            )}
            {recentTransactions.map((transaction) => (
              <div key={transaction.id} className="p-4 flex items-center justify-between hover:bg-[rgba(255,255,255,0.03)] transition-colors">
                <div className="flex-1">
                  <p className="font-medium text-[#F8FAFC] font-jakarta">{transaction.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-jakarta ${statusBadge(transaction.status)}`}>
                      {transaction.status}
                    </span>
                    <span className="text-sm text-[#64748B] font-jakarta">{transaction.date}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`font-semibold font-jakarta ${
                      transaction.type === "income" ? "text-[#10B981]" : "text-[#EF4444]"
                    }`}
                  >
                    {transaction.type === "income" ? "+" : "-"}
                    {transaction.amountStr}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-[rgba(255,255,255,0.07)] text-center">
            <Link
              href="/tenant-admin/expenses"
              className="text-[#6366F1] hover:text-[#818CF8] font-medium flex items-center justify-center gap-2 transition-colors font-jakarta"
            >
              View All Transactions
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="bg-[#1A2438] rounded-[14px] border border-[rgba(255,255,255,0.07)]" style={{ boxShadow: '0 4px 14px rgba(0,0,0,.2)' }}>
          <div className="p-6 border-b border-[rgba(255,255,255,0.07)]">
            <h2 className="text-lg font-semibold text-[#F8FAFC] flex items-center gap-2 font-jakarta">
              <PieChart className="h-5 w-5 text-[#94A3B8]" />
              Expenses by Category
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {expenseBreakdown.length === 0 && (
              <div className="text-center text-[#64748B] py-4 font-jakarta">No expense data</div>
            )}
            {expenseBreakdown.map((category, idx) => {
              const total = expenseBreakdown.reduce(
                (sum, c) => sum + Number(c.amount.replace(/[^0-9.]/g, "") || 0),
                0
              );
              const value = Number(category.amount.replace(/[^0-9.]/g, "") || 0);
              const pct = total > 0 ? Math.round((value / total) * 100) : 0;
              return (
                <div key={category.label}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[#F8FAFC] font-jakarta">{category.label}</span>
                    <span className="text-sm font-semibold text-[#F8FAFC] font-jakarta">{category.amount}</span>
                  </div>
                  <div className="w-full bg-[#111827] rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${categoryColors[idx % categoryColors.length]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className={`text-xs mt-1 font-jakarta ${category.direction === "up" ? "text-[#EF4444]" : "text-[#10B981]"}`}>
                    {category.delta}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          href="/tenant-admin/expenses"
          className="p-5 bg-[#1A2438] rounded-[14px] border border-[rgba(255,255,255,0.07)] hover:border-[rgba(99,102,241,.3)] transition-all text-center group"
          style={{ boxShadow: '0 4px 14px rgba(0,0,0,.2)' }}
        >
          <div className="w-10 h-10 rounded-[10px] bg-[rgba(99,102,241,.12)] flex items-center justify-center mx-auto mb-3">
            <DollarSign className="h-5 w-5 text-[#818CF8]" />
          </div>
          <p className="text-sm font-medium text-[#F8FAFC] font-jakarta group-hover:text-[#818CF8] transition-colors">Manage Expenses</p>
        </Link>
        <Link
          href="/tenant-admin/bills"
          className="p-5 bg-[#1A2438] rounded-[14px] border border-[rgba(255,255,255,0.07)] hover:border-[rgba(245,158,11,.3)] transition-all text-center group"
          style={{ boxShadow: '0 4px 14px rgba(0,0,0,.2)' }}
        >
          <div className="w-10 h-10 rounded-[10px] bg-[rgba(245,158,11,.12)] flex items-center justify-center mx-auto mb-3">
            <DollarSign className="h-5 w-5 text-[#F59E0B]" />
          </div>
          <p className="text-sm font-medium text-[#F8FAFC] font-jakarta group-hover:text-[#F59E0B] transition-colors">Bills</p>
        </Link>
        <Link
          href="/tenant-admin/payments"
          className="p-5 bg-[#1A2438] rounded-[14px] border border-[rgba(255,255,255,0.07)] hover:border-[rgba(16,185,129,.3)] transition-all text-center group"
          style={{ boxShadow: '0 4px 14px rgba(0,0,0,.2)' }}
        >
          <div className="w-10 h-10 rounded-[10px] bg-[rgba(16,185,129,.12)] flex items-center justify-center mx-auto mb-3">
            <TrendingUp className="h-5 w-5 text-[#10B981]" />
          </div>
          <p className="text-sm font-medium text-[#F8FAFC] font-jakarta group-hover:text-[#10B981] transition-colors">Payments</p>
        </Link>
        <Link
          href="/tenant-admin/finance/reports"
          className="p-5 bg-[#1A2438] rounded-[14px] border border-[rgba(255,255,255,0.07)] hover:border-[rgba(129,140,248,.3)] transition-all text-center group"
          style={{ boxShadow: '0 4px 14px rgba(0,0,0,.2)' }}
        >
          <div className="w-10 h-10 rounded-[10px] bg-[rgba(129,140,248,.12)] flex items-center justify-center mx-auto mb-3">
            <PieChart className="h-5 w-5 text-[#818CF8]" />
          </div>
          <p className="text-sm font-medium text-[#F8FAFC] font-jakarta group-hover:text-[#818CF8] transition-colors">Reports</p>
        </Link>
      </div>
    </div>
  );
}
