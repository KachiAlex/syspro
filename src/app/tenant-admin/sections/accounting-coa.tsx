"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  X,
  AlertCircle,
  Loader2,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";
import type { ChartOfAccount, ChartOfAccountCreateInput } from "@/lib/accounting/types";

interface ChartOfAccountsWorkspaceProps {
  tenantSlug: string;
}

export default function ChartOfAccountsWorkspace({
  tenantSlug,
}: ChartOfAccountsWorkspaceProps) {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<ChartOfAccount | null>(null);
  const [filterType, setFilterType] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState<Partial<ChartOfAccountCreateInput>>({
    accountCode: "",
    accountName: "",
    accountType: "ASSET",
    description: "",
  });

  // Load accounts
  useEffect(() => {
    loadAccounts();
  }, [tenantSlug, filterType]);

  async function loadAccounts() {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        tenantSlug,
        ...(filterType && { accountType: filterType }),
      });

      const response = await fetch(`/api/accounting/accounts?${params}`);
      if (!response.ok) throw new Error("Failed to load accounts");

      const data = await response.json();
      setAccounts(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading accounts");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAccount() {
    try {
      if (!formData.accountCode || !formData.accountName) {
        setError("Account code and name are required");
        return;
      }

      const payload = {
        ...formData,
        tenantSlug,
        createdBy: "current-user",
      };

      const response = await fetch("/api/accounting/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.toString() || "Failed to create account");
      }

      setFormData({ accountCode: "", accountName: "", accountType: "ASSET", description: "" });
      setShowForm(false);
      loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving account");
    }
  }

  const filteredAccounts = accounts.filter((acc) => {
    const matchesSearch =
      acc.accountCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.accountName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const accountsByType = {
    ASSET: filteredAccounts.filter((a) => a.accountType === "ASSET"),
    LIABILITY: filteredAccounts.filter((a) => a.accountType === "LIABILITY"),
    EQUITY: filteredAccounts.filter((a) => a.accountType === "EQUITY"),
    INCOME: filteredAccounts.filter((a) => a.accountType === "INCOME"),
    EXPENSE: filteredAccounts.filter((a) => a.accountType === "EXPENSE"),
  };

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">General Ledger</p>
            <h2 className="text-2xl font-semibold text-slate-900">Chart of Accounts</h2>
          </div>
          <button
            onClick={() => {
              setFormData({ accountCode: "", accountName: "", accountType: "ASSET", description: "" });
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Account
          </button>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search by code or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-blue-300"
          >
            <option value="">All Types</option>
            <option value="ASSET">Assets</option>
            <option value="LIABILITY">Liabilities</option>
            <option value="EQUITY">Equity</option>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expenses</option>
          </select>
        </div>

        {/* Error State */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-900">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              <p className="text-sm text-slate-500">Loading chart of accounts...</p>
            </div>
          </div>
        )}

        {/* Accounts by Type */}
        {!loading && (
          <div className="space-y-6">
            {Object.entries(accountsByType).map(([type, typeAccounts]) => (
              typeAccounts.length > 0 && (
                <div key={type}>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-3">
                    {type}S
                  </h3>
                  <div className="space-y-2">
                    {typeAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-mono text-sm font-semibold text-slate-900">
                                {account.accountCode}
                              </p>
                              <p className="text-sm text-slate-600">{account.accountName}</p>
                            </div>
                          </div>
                          {account.description && (
                            <p className="text-xs text-slate-500 mt-1">{account.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {account.isSystemAccount && (
                            <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-slate-200 text-slate-700">
                              System
                            </span>
                          )}
                          {!account.isActive && (
                            <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                              Inactive
                            </span>
                          )}
                          {account.requireCostCenter && (
                            <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                              Cost Center
                            </span>
                          )}
                          <button
                            onClick={() => setSelectedAccount(account)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setShowForm(false)}
            />
            <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 overflow-y-auto rounded-l-3xl">
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-slate-900">New Account</h3>
                  <button
                    onClick={() => setShowForm(false)}
                    className="text-slate-600 hover:text-slate-900"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Account Code */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      Account Code *
                    </label>
                    <input
                      type="text"
                      value={formData.accountCode || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, accountCode: e.target.value })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300"
                      placeholder="1000"
                    />
                  </div>

                  {/* Account Name */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      Account Name *
                    </label>
                    <input
                      type="text"
                      value={formData.accountName || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, accountName: e.target.value })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300"
                      placeholder="Cash"
                    />
                  </div>

                  {/* Account Type */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      Type *
                    </label>
                    <select
                      value={formData.accountType || "ASSET"}
                      onChange={(e) =>
                        setFormData({ ...formData, accountType: e.target.value as any })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="ASSET">Asset</option>
                      <option value="LIABILITY">Liability</option>
                      <option value="EQUITY">Equity</option>
                      <option value="INCOME">Income</option>
                      <option value="EXPENSE">Expense</option>
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300"
                      rows={3}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => setShowForm(false)}
                    className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAccount}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Create Account
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
