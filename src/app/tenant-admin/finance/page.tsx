"use client";

import React, { useState, useEffect } from "react";
import { useCallback } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart,
  Calendar,
  ArrowRight,
  Loader2,
  Landmark,
  Plus,
  X,
} from "lucide-react";
import Link from "next/link";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { TrendChart } from "@/components/tenant-admin/trend-chart";
import { CURRENCY_SYMBOL_OPTIONS } from "@/lib/currencies";

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

interface CashAccount {
  id: string;
  name: string;
  type: "bank" | "cash";
  balance: string;
  currency: string;
  trend: "up" | "down";
  change: string;
  region: string;
  bankName?: string | null;
  accountName?: string | null;
  maskedAccountNumber?: string | null;
}

interface BankOption {
  name: string;
  code?: string;
}

interface DashboardData {
  metrics: DashboardMetric[];
  receivables: ScheduleItem[];
  payables: ScheduleItem[];
  expenseBreakdown: ExpenseBreakdownItem[];
  cashAccounts?: CashAccount[];
  trend?: { labels: string[]; revenue: number[]; expenses: number[] };
}

const periodToTimeframe: Record<string, string> = {
  month: "last_30_days",
  quarter: "quarter_to_date",
  year: "year_to_date",
};

const categoryColors = [
  "bg-theme-accent",
  "bg-theme-success",
  "bg-theme-warning",
  "bg-[#E8286E]",
  "bg-theme-danger",
  "bg-[#14B8A6]",
  "bg-[#FCD34D]",
  "bg-[#C0208A]",
];

export default function FinanceDashboard() {
  const { tenantSlug } = useTenantContext();
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const emptyAccountForm = {
    name: "",
    type: "bank" as "bank" | "cash",
    currency: "₦",
    balance: "",
    bankName: "",
    bankCode: "",
    accountNumber: "",
    accountName: "",
    swiftCode: "",
  };
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [bankOptions, setBankOptions] = useState<BankOption[]>([]);
  const [banksCountry, setBanksCountry] = useState<string | null>(null);
  const [resolveAvailable, setResolveAvailable] = useState(false);
  const [resolvingName, setResolvingName] = useState(false);
  const [resolveNote, setResolveNote] = useState<string | null>(null);
  const [nameAutofilled, setNameAutofilled] = useState(false);

  const loadDashboard = useCallback(async () => {
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
  }, [period, tenantSlug]);

  useEffect(() => {
    if (tenantSlug) loadDashboard();
  }, [loadDashboard, tenantSlug]);

  const openAccountForm = useCallback(async () => {
    setShowAccountForm(true);
    setAccountForm(emptyAccountForm);
    setAccountError(null);
    setResolveNote(null);
    setNameAutofilled(false);
    if (!tenantSlug || bankOptions.length) return;
    try {
      const res = await fetch(`/api/finance/banks?tenantSlug=${encodeURIComponent(tenantSlug)}`);
      if (!res.ok) return;
      const payload = await res.json();
      setBankOptions(Array.isArray(payload.banks) ? payload.banks : []);
      setBanksCountry(payload.countryCode ?? null);
      setResolveAvailable(Boolean(payload.resolvable));
    } catch {
      // bank directory unavailable — the name field falls back to free text
    }
  }, [tenantSlug, bankOptions.length]);

  // Resolve the account name automatically once a coded bank is selected
  // and the account number looks complete.
  useEffect(() => {
    if (!showAccountForm || accountForm.type !== "bank") return;
    const digits = accountForm.accountNumber.replace(/\D/g, "");
    if (!accountForm.bankCode || digits.length < 8) {
      if (!digits.length) setResolveNote(null);
      return;
    }
    if (!resolveAvailable) {
      setResolveNote("Name lookup needs an active Paystack gateway — the name can be entered manually.");
      return;
    }
    let cancelled = false;
    setResolvingName(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/finance/banks/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantSlug, bankCode: accountForm.bankCode, accountNumber: digits }),
        });
        const payload = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && payload.accountName) {
          setAccountForm((prev) => {
            const next = { ...prev, accountName: payload.accountName };
            if (!prev.name || nameAutofilled) next.name = payload.accountName;
            return next;
          });
          setNameAutofilled(true);
          setResolveNote(null);
        } else {
          setResolveNote(typeof payload.error === "string" ? payload.error : "Could not verify the account name");
        }
      } catch {
        if (!cancelled) setResolveNote("Account lookup failed — the name can be entered manually.");
      } finally {
        if (!cancelled) setResolvingName(false);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [accountForm.accountNumber, accountForm.bankCode, accountForm.type, showAccountForm, resolveAvailable, tenantSlug, nameAutofilled]);

  const saveAccount = async () => {
    if (!tenantSlug) return;
    const balance = Number(accountForm.balance);
    if (!accountForm.name.trim()) {
      setAccountError("Account name is required");
      return;
    }
    if (!accountForm.balance || !Number.isFinite(balance)) {
      setAccountError("Opening balance must be a number");
      return;
    }
    if (accountForm.type === "bank" && (!accountForm.bankName.trim() || accountForm.bankName === "__other__")) {
      setAccountError("Select or enter the bank");
      return;
    }
    setSavingAccount(true);
    setAccountError(null);
    try {
      const isBank = accountForm.type === "bank";
      const res = await fetch("/api/finance/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          name: accountForm.name.trim(),
          type: accountForm.type,
          currency: accountForm.currency,
          balance,
          bankName: isBank ? accountForm.bankName.trim() : undefined,
          bankCode: isBank && accountForm.bankCode ? accountForm.bankCode : undefined,
          accountNumber: isBank && accountForm.accountNumber ? accountForm.accountNumber.replace(/\D/g, "") : undefined,
          accountName: isBank && accountForm.accountName ? accountForm.accountName : undefined,
          swiftCode: isBank && accountForm.swiftCode.trim() ? accountForm.swiftCode.trim() : undefined,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ? JSON.stringify(payload.error) : "Failed to create account");
      setShowAccountForm(false);
      setAccountForm(emptyAccountForm);
      setNameAutofilled(false);
      setResolveNote(null);
      await loadDashboard();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setSavingAccount(false);
    }
  };

  const metrics = Array.isArray(data?.metrics) ? data.metrics : [];
  const cashAccounts = data?.cashAccounts ?? [];

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
    if (label.toLowerCase().includes("revenue")) return <TrendingUp className="h-6 w-6 text-theme-success" />;
    if (label.toLowerCase().includes("burn") || label.toLowerCase().includes("expense")) return <TrendingDown className="h-6 w-6 text-theme-danger" />;
    if (label.toLowerCase().includes("cash")) return <DollarSign className="h-6 w-6 text-theme-primary" />;
    return <PieChart className="h-6 w-6 text-theme-accent" />;
  };

  const statusBadge = (status: string) => {
    const classes: Record<string, string> = {
      current: "bg-[rgba(16,185,129,.12)] text-theme-success",
      due_soon: "bg-[rgba(245,158,11,.12)] text-theme-warning",
      overdue: "bg-[rgba(239,68,68,.12)] text-theme-danger",
    };
    return classes[status] || "bg-[rgba(255,255,255,.04)] text-theme-text-secondary";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-theme-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-theme-text-primary font-jakarta">Finance Dashboard</h1>
          <p className="text-theme-text-secondary mt-2 font-jakarta">
            Overview of your financial performance and recent transactions
          </p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-4 py-2 border border-theme-border rounded-[10px] text-sm font-medium text-theme-text-primary bg-theme-muted hover:bg-theme-surface focus:outline-none focus:border-[rgba(227,30,36,.4)] focus:shadow-[0_0_0_3px_rgba(227,30,36,.08)] cursor-pointer"
        >
          <option value="month" className="bg-theme-surface text-theme-text-primary">This Month</option>
          <option value="quarter" className="bg-theme-surface text-theme-text-primary">This Quarter</option>
          <option value="year" className="bg-theme-surface text-theme-text-primary">This Year</option>
        </select>
      </div>

      {error && (
        <div className="bg-[rgba(239,68,68,.08)] border border-[rgba(239,68,68,.2)] text-theme-danger px-4 py-3 rounded-[10px]">
          {error}
          <button onClick={loadDashboard} className="ml-4 underline text-sm">Retry</button>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="bg-theme-surface rounded-[14px] p-6 border border-theme-border transition-all hover:-translate-y-[1px]"
            style={{ boxShadow: '0 4px 14px rgba(0,0,0,.2)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-theme-text-secondary font-jakarta">{metric.label}</h3>
              {iconForMetric(metric.label)}
            </div>
            <div>
              <div className="text-2xl font-bold text-theme-text-primary font-jakarta">{metric.value}</div>
              <div
                className={`text-sm mt-2 flex items-center gap-1 font-jakarta ${
                  metric.trend === "up" ? "text-theme-success" : "text-theme-danger"
                }`}
              >
                {metric.trend === "up" ? "↑" : "↓"}
                <span>{metric.delta}</span>
                <span className="text-theme-text-tertiary ml-1">{metric.description}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue vs Expenses trend — same snapshot trend data */}
      {data?.trend && data.trend.labels?.length >= 2 && (
        <div className="bg-theme-surface rounded-[14px] border border-theme-border p-6" style={{ boxShadow: '0 4px 14px rgba(0,0,0,.2)' }}>
          <h2 className="text-lg font-semibold text-theme-text-primary mb-4 font-jakarta">
            Revenue vs Expenses
          </h2>
          <TrendChart labels={data.trend.labels} revenue={data.trend.revenue} expenses={data.trend.expenses} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="lg:col-span-2 bg-theme-surface rounded-[14px] border border-theme-border" style={{ boxShadow: '0 4px 14px rgba(0,0,0,.2)' }}>
          <div className="p-6 border-b border-theme-border">
            <h2 className="text-lg font-semibold text-theme-text-primary flex items-center gap-2 font-jakarta">
              <Calendar className="h-5 w-5 text-theme-text-secondary" />
              Receivables & Payables
            </h2>
          </div>
          <div className="divide-y divide-theme-border">
            {recentTransactions.length === 0 && (
              <div className="p-8 text-center text-theme-text-tertiary">No recent transactions</div>
            )}
            {recentTransactions.map((transaction) => (
              <div key={transaction.id} className="p-4 flex items-center justify-between hover:bg-theme-sidebar-hover transition-colors">
                <div className="flex-1">
                  <p className="font-medium text-theme-text-primary font-jakarta">{transaction.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-jakarta ${statusBadge(transaction.status)}`}>
                      {transaction.status}
                    </span>
                    <span className="text-sm text-theme-text-tertiary font-jakarta">{transaction.date}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`font-semibold font-jakarta ${
                      transaction.type === "income" ? "text-theme-success" : "text-theme-danger"
                    }`}
                  >
                    {transaction.type === "income" ? "+" : "-"}
                    {transaction.amountStr}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-theme-border text-center">
            <Link
              href="/tenant-admin/expenses"
              className="text-theme-primary hover:text-theme-accent font-medium flex items-center justify-center gap-2 transition-colors font-jakarta"
            >
              View All Transactions
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="bg-theme-surface rounded-[14px] border border-theme-border" style={{ boxShadow: '0 4px 14px rgba(0,0,0,.2)' }}>
          <div className="p-6 border-b border-theme-border">
            <h2 className="text-lg font-semibold text-theme-text-primary flex items-center gap-2 font-jakarta">
              <PieChart className="h-5 w-5 text-theme-text-secondary" />
              Expenses by Category
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {expenseBreakdown.length === 0 && (
              <div className="text-center text-theme-text-tertiary py-4 font-jakarta">No expense data</div>
            )}
            {expenseBreakdown.map((category, idx) => {
              const total = expenseBreakdown.reduce(
                (sum, c) => sum + Number(String(c.amount || 0).replace(/[^0-9.\-]/g, "") || 0),
                0
              );
              const value = Number(String(category.amount || 0).replace(/[^0-9.\-]/g, "") || 0);
              const pct = total > 0 ? Math.round((value / total) * 100) : 0;
              return (
                <div key={category.label}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-theme-text-primary font-jakarta">{category.label}</span>
                    <span className="text-sm font-semibold text-theme-text-primary font-jakarta">{category.amount}</span>
                  </div>
                  <div className="w-full bg-theme-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${categoryColors[idx % categoryColors.length]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className={`text-xs mt-1 font-jakarta ${category.direction === "up" ? "text-theme-danger" : "text-theme-success"}`}>
                    {category.delta}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cash & Bank Accounts — dashboard-level cash accounts (finance_accounts) */}
      <div className="bg-theme-surface rounded-[14px] border border-theme-border" style={{ boxShadow: '0 4px 14px rgba(0,0,0,.2)' }}>
        <div className="p-6 border-b border-theme-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-theme-text-primary flex items-center gap-2 font-jakarta">
            <Landmark className="h-5 w-5 text-theme-text-secondary" />
            Cash &amp; Bank Accounts
          </h2>
          <button
            onClick={openAccountForm}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-theme-accent text-white text-sm font-medium hover:opacity-90 transition-opacity font-jakarta"
          >
            <Plus className="h-4 w-4" />
            Add Account
          </button>
        </div>
        <div className="divide-y divide-theme-border">
          {cashAccounts.length === 0 && (
            <div className="p-8 text-center text-theme-text-tertiary font-jakarta">
              No bank or cash accounts yet — add one to start tracking your cash position.
            </div>
          )}
          {cashAccounts.map((account) => (
            <div key={account.id} className="p-4 flex items-center justify-between hover:bg-theme-sidebar-hover transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-[rgba(129,140,248,.12)] flex items-center justify-center">
                  <Landmark className="h-4 w-4 text-theme-accent" />
                </div>
                <div>
                  <p className="font-medium text-theme-text-primary font-jakarta">{account.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(255,255,255,.04)] text-theme-text-secondary font-jakarta">
                      {account.type === "bank" ? "Bank" : "Cash"}
                    </span>
                    {account.bankName && (
                      <span className="text-xs text-theme-text-secondary font-jakarta">{account.bankName}</span>
                    )}
                    {account.maskedAccountNumber && (
                      <span className="text-xs text-theme-text-tertiary font-jakarta">{account.maskedAccountNumber}</span>
                    )}
                    <span className="text-xs text-theme-text-tertiary font-jakarta">{account.region}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-theme-text-primary font-jakarta">{account.balance}</p>
                <p className={`text-xs font-jakarta ${account.trend === "down" ? "text-theme-danger" : "text-theme-success"}`}>
                  {account.change}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-theme-border text-center text-xs text-theme-text-tertiary font-jakarta">
          These are dashboard cash accounts. For the GL chart of accounts used by Bank Recon, see{" "}
          <Link href="/tenant-admin/finance/coa" className="text-theme-primary hover:text-theme-accent">
            Chart of Accounts
          </Link>
          .
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          href="/tenant-admin/expenses"
          className="p-5 bg-theme-surface rounded-[14px] border border-theme-border hover:border-[rgba(227,30,36,.3)] transition-all text-center group"
          style={{ boxShadow: '0 4px 14px rgba(0,0,0,.2)' }}
        >
          <div className="w-10 h-10 rounded-[10px] bg-[rgba(227,30,36,.12)] flex items-center justify-center mx-auto mb-3">
            <DollarSign className="h-5 w-5 text-theme-accent" />
          </div>
          <p className="text-sm font-medium text-theme-text-primary font-jakarta group-hover:text-theme-accent transition-colors">Manage Expenses</p>
        </Link>
        <Link
          href="/tenant-admin/bills"
          className="p-5 bg-theme-surface rounded-[14px] border border-theme-border hover:border-[rgba(245,158,11,.3)] transition-all text-center group"
          style={{ boxShadow: '0 4px 14px rgba(0,0,0,.2)' }}
        >
          <div className="w-10 h-10 rounded-[10px] bg-[rgba(245,158,11,.12)] flex items-center justify-center mx-auto mb-3">
            <DollarSign className="h-5 w-5 text-theme-warning" />
          </div>
          <p className="text-sm font-medium text-theme-text-primary font-jakarta group-hover:text-theme-warning transition-colors">Bills</p>
        </Link>
        <Link
          href="/tenant-admin/payments"
          className="p-5 bg-theme-surface rounded-[14px] border border-theme-border hover:border-[rgba(16,185,129,.3)] transition-all text-center group"
          style={{ boxShadow: '0 4px 14px rgba(0,0,0,.2)' }}
        >
          <div className="w-10 h-10 rounded-[10px] bg-[rgba(16,185,129,.12)] flex items-center justify-center mx-auto mb-3">
            <TrendingUp className="h-5 w-5 text-theme-success" />
          </div>
          <p className="text-sm font-medium text-theme-text-primary font-jakarta group-hover:text-theme-success transition-colors">Payments</p>
        </Link>
        <Link
          href="/tenant-admin/finance/reports"
          className="p-5 bg-theme-surface rounded-[14px] border border-theme-border hover:border-[rgba(129,140,248,.3)] transition-all text-center group"
          style={{ boxShadow: '0 4px 14px rgba(0,0,0,.2)' }}
        >
          <div className="w-10 h-10 rounded-[10px] bg-[rgba(129,140,248,.12)] flex items-center justify-center mx-auto mb-3">
            <PieChart className="h-5 w-5 text-theme-accent" />
          </div>
          <p className="text-sm font-medium text-theme-text-primary font-jakarta group-hover:text-theme-accent transition-colors">Reports</p>
        </Link>
      </div>

      {/* Add Account modal */}
      {showAccountForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-theme-surface border border-theme-border rounded-[14px] p-6" style={{ boxShadow: '0 12px 40px rgba(0,0,0,.4)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-theme-text-primary font-jakarta">Add Cash/Bank Account</h3>
              <button
                onClick={() => { setShowAccountForm(false); setAccountError(null); }}
                className="text-theme-text-tertiary hover:text-theme-text-primary transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-theme-text-secondary mb-1.5 font-jakarta">Type</label>
                  <select
                    value={accountForm.type}
                    onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value as "bank" | "cash" })}
                    className="w-full px-4 py-2 border border-theme-border rounded-[10px] text-sm font-medium text-theme-text-primary bg-theme-muted hover:bg-theme-surface focus:outline-none focus:border-[rgba(227,30,36,.4)] cursor-pointer"
                  >
                    <option value="bank">Bank</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-text-secondary mb-1.5 font-jakarta">Currency</label>
                  <select
                    value={accountForm.currency}
                    onChange={(e) => setAccountForm({ ...accountForm, currency: e.target.value })}
                    className="w-full px-4 py-2 border border-theme-border rounded-[10px] text-sm font-medium text-theme-text-primary bg-theme-muted hover:bg-theme-surface focus:outline-none focus:border-[rgba(227,30,36,.4)] cursor-pointer"
                  >
                    {CURRENCY_SYMBOL_OPTIONS.map((c) => (
                      <option key={c.code} value={c.symbol}>
                        {c.symbol} — {c.code} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {accountForm.type === "bank" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-theme-text-secondary mb-1.5 font-jakarta">
                      Bank{banksCountry ? ` (${banksCountry})` : ""}
                    </label>
                    {bankOptions.length > 0 ? (
                      <select
                        value={accountForm.bankName}
                        onChange={(e) => {
                          const bank = bankOptions.find((b) => b.name === e.target.value);
                          setAccountForm({
                            ...accountForm,
                            bankName: e.target.value,
                            bankCode: bank?.code ?? "",
                            accountName: "",
                          });
                          setResolveNote(null);
                        }}
                        className="w-full px-4 py-2 border border-theme-border rounded-[10px] text-sm font-medium text-theme-text-primary bg-theme-muted hover:bg-theme-surface focus:outline-none focus:border-[rgba(227,30,36,.4)] cursor-pointer"
                      >
                        <option value="">Select bank…</option>
                        {bankOptions.map((b) => (
                          <option key={b.name} value={b.name}>{b.name}</option>
                        ))}
                        <option value="__other__">Other (not listed)</option>
                      </select>
                    ) : null}
                    {(bankOptions.length === 0 || accountForm.bankName === "__other__") && (
                      <input
                        type="text"
                        value={accountForm.bankName === "__other__" ? "" : accountForm.bankName}
                        onChange={(e) => setAccountForm({ ...accountForm, bankName: e.target.value, bankCode: "", accountName: "" })}
                        placeholder="Bank name"
                        className="w-full px-4 py-2 border border-theme-border rounded-[10px] text-sm text-theme-text-primary bg-theme-muted focus:outline-none focus:border-[rgba(227,30,36,.4)] focus:shadow-[0_0_0_3px_rgba(227,30,36,.08)] font-jakarta"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-theme-text-secondary mb-1.5 font-jakarta">Account number</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={accountForm.accountNumber}
                      onChange={(e) => setAccountForm({ ...accountForm, accountNumber: e.target.value, accountName: "" })}
                      placeholder="e.g. 0123456789"
                      className="w-full px-4 py-2 border border-theme-border rounded-[10px] text-sm text-theme-text-primary bg-theme-muted focus:outline-none focus:border-[rgba(227,30,36,.4)] focus:shadow-[0_0_0_3px_rgba(227,30,36,.08)] font-jakarta"
                    />
                    {resolvingName && (
                      <p className="text-xs text-theme-text-tertiary mt-1.5 font-jakarta flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" /> Verifying account…
                      </p>
                    )}
                    {!resolvingName && accountForm.accountName && (
                      <p className="text-xs text-theme-success mt-1.5 font-jakarta">
                        ✓ {accountForm.accountName}
                      </p>
                    )}
                    {!resolvingName && resolveNote && (
                      <p className="text-xs text-theme-text-tertiary mt-1.5 font-jakarta">{resolveNote}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-theme-text-secondary mb-1.5 font-jakarta">SWIFT / BIC (optional)</label>
                    <input
                      type="text"
                      value={accountForm.swiftCode}
                      onChange={(e) => setAccountForm({ ...accountForm, swiftCode: e.target.value })}
                      placeholder="e.g. ZEIBNGLA"
                      className="w-full px-4 py-2 border border-theme-border rounded-[10px] text-sm text-theme-text-primary bg-theme-muted focus:outline-none focus:border-[rgba(227,30,36,.4)] focus:shadow-[0_0_0_3px_rgba(227,30,36,.08)] font-jakarta"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-1.5 font-jakarta">Account name</label>
                <input
                  type="text"
                  value={accountForm.name}
                  onChange={(e) => { setAccountForm({ ...accountForm, name: e.target.value }); setNameAutofilled(false); }}
                  placeholder={accountForm.type === "bank" ? "Auto-filled when the account number resolves" : "e.g. Petty cash — HQ"}
                  className="w-full px-4 py-2 border border-theme-border rounded-[10px] text-sm text-theme-text-primary bg-theme-muted focus:outline-none focus:border-[rgba(227,30,36,.4)] focus:shadow-[0_0_0_3px_rgba(227,30,36,.08)] font-jakarta"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-1.5 font-jakarta">Opening balance</label>
                <input
                  type="number"
                  step="0.01"
                  value={accountForm.balance}
                  onChange={(e) => setAccountForm({ ...accountForm, balance: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-theme-border rounded-[10px] text-sm text-theme-text-primary bg-theme-muted focus:outline-none focus:border-[rgba(227,30,36,.4)] focus:shadow-[0_0_0_3px_rgba(227,30,36,.08)] font-jakarta"
                />
              </div>
              {accountError && (
                <div className="bg-[rgba(239,68,68,.08)] border border-[rgba(239,68,68,.2)] text-theme-danger text-sm px-3 py-2 rounded-[10px] font-jakarta">
                  {accountError}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => { setShowAccountForm(false); setAccountError(null); }}
                  className="px-4 py-2 rounded-[10px] border border-theme-border text-sm font-medium text-theme-text-secondary hover:bg-theme-muted transition-colors font-jakarta"
                >
                  Cancel
                </button>
                <button
                  onClick={saveAccount}
                  disabled={savingAccount}
                  className="px-4 py-2 rounded-[10px] bg-theme-accent text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 font-jakarta"
                >
                  {savingAccount && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
