"use client";

import React, { useState, useEffect } from "react";
import { useCallback } from "react";
import {
  Plus,
  X,
  AlertCircle,
  Loader2,
  Check,
  Eye,
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


  const loadAccounts = useCallback(async () => {
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
  }, [filterType, tenantSlug]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

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

  const TYPE_LABELS: Record<string, string> = {
    ASSET: "Assets",
    LIABILITY: "Liabilities",
    EQUITY: "Equity",
    INCOME: "Income",
    EXPENSE: "Expenses",
  };

  return (
    <div className="rounded-3xl border border-theme-border bg-theme-muted p-8 shadow-sm">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-theme-text-secondary">General Ledger</p>
            <h2 className="text-2xl font-semibold text-theme-text-primary">Chart of Accounts</h2>
            <p className="text-xs text-theme-text-tertiary mt-1">
              Asset accounts coded 1000–1199 appear as bank accounts in Bank Recon.
            </p>
          </div>
          <button
            onClick={() => {
              setFormData({ accountCode: "", accountName: "", accountType: "ASSET", description: "" });
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-theme-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-theme-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-accent"
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
            className="flex-1 rounded-lg border border-theme-border bg-theme-surface px-4 py-2 text-sm text-theme-text-primary outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-theme-border bg-theme-surface px-4 py-2 text-sm text-theme-text-primary outline-none focus:border-blue-300"
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
              <Loader2 className="h-8 w-8 animate-spin text-theme-text-secondary" />
              <p className="text-sm text-theme-text-tertiary">Loading chart of accounts...</p>
            </div>
          </div>
        )}

        {/* Accounts by Type */}
        {!loading && (
          <div className="space-y-6">
            {Object.entries(accountsByType).map(([type, typeAccounts]) => (
              typeAccounts.length > 0 && (
                <div key={type}>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-theme-text-secondary mb-3">
                    {TYPE_LABELS[type] ?? type}
                  </h3>
                  <div className="space-y-2">
                    {typeAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between rounded-lg border border-theme-border bg-theme-muted p-4 hover:bg-theme-muted transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-mono text-sm font-semibold text-theme-text-primary">
                                {account.accountCode}
                              </p>
                              <p className="text-sm text-theme-text-secondary">{account.accountName}</p>
                            </div>
                          </div>
                          {account.description && (
                            <p className="text-xs text-theme-text-tertiary mt-1">{account.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {account.isSystemAccount && (
                            <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-theme-muted text-theme-text-primary">
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
                            className="text-theme-text-secondary hover:text-theme-text-secondary"
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

        {/* Details Modal */}
        {selectedAccount && (
          <>
            <div
              className="fixed inset-0 bg-theme-overlay z-40"
              onClick={() => setSelectedAccount(null)}
            />
            <div className="fixed right-0 top-0 h-full w-full max-w-md bg-theme-surface shadow-xl z-50 overflow-y-auto rounded-l-3xl">
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-theme-text-primary">Account Details</h3>
                  <button
                    onClick={() => setSelectedAccount(null)}
                    className="text-theme-text-secondary hover:text-theme-text-primary"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <dl className="space-y-4 text-sm">
                  {[
                    ["Code", selectedAccount.accountCode],
                    ["Name", selectedAccount.accountName],
                    ["Type", selectedAccount.accountType],
                    ["Sub-type", selectedAccount.subType || "—"],
                    ["Description", selectedAccount.description || "—"],
                    ["Currency", selectedAccount.currency || "—"],
                    ["Status", selectedAccount.isActive ? "Active" : "Inactive"],
                    ["System account", selectedAccount.isSystemAccount ? "Yes" : "No"],
                    ["Manual posting", selectedAccount.allowManualPosting ? "Allowed" : "Not allowed"],
                    ["Reconciliation account", selectedAccount.isReconciliationAccount ? "Yes" : "No"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-4 border-b border-theme-border pb-2">
                      <dt className="text-theme-text-secondary">{label}</dt>
                      <dd className="font-medium text-theme-text-primary text-right">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </>
        )}

        {/* Form Modal */}
        {showForm && (
          <>
            <div
              className="fixed inset-0 bg-theme-overlay z-40"
              onClick={() => setShowForm(false)}
            />
            <div className="fixed right-0 top-0 h-full w-full max-w-md bg-theme-surface shadow-xl z-50 overflow-y-auto rounded-l-3xl">
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-theme-text-primary">New Account</h3>
                  <button
                    onClick={() => setShowForm(false)}
                    className="text-theme-text-secondary hover:text-theme-text-primary"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Account Code */}
                  <div>
                    <label className="block text-sm font-semibold text-theme-text-primary mb-2">
                      Account Code *
                    </label>
                    <input
                      type="text"
                      value={formData.accountCode || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, accountCode: e.target.value })
                      }
                      className="bg-theme-surface w-full rounded-lg border border-theme-border px-3 py-2 text-sm outline-none focus:border-blue-300 text-theme-text-primary"
                      placeholder="1000"
                    />
                  </div>

                  {/* Account Name */}
                  <div>
                    <label className="block text-sm font-semibold text-theme-text-primary mb-2">
                      Account Name *
                    </label>
                    <input
                      type="text"
                      value={formData.accountName || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, accountName: e.target.value })
                      }
                      className="bg-theme-surface w-full rounded-lg border border-theme-border px-3 py-2 text-sm outline-none focus:border-blue-300 text-theme-text-primary"
                      placeholder="Cash"
                    />
                  </div>

                  {/* Account Type */}
                  <div>
                    <label className="block text-sm font-semibold text-theme-text-primary mb-2">
                      Type *
                    </label>
                    <select
                      value={formData.accountType || "ASSET"}
                      onChange={(e) =>
                        setFormData({ ...formData, accountType: e.target.value as any })
                      }
                      className="bg-theme-surface w-full rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text-primary"
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
                    <label className="block text-sm font-semibold text-theme-text-primary mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      className="bg-theme-surface w-full rounded-lg border border-theme-border px-3 py-2 text-sm outline-none focus:border-blue-300 text-theme-text-primary"
                      rows={3}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-theme-border">
                  <button
                    onClick={() => setShowForm(false)}
                    className="flex-1 rounded-lg border border-theme-border px-4 py-2 text-sm font-semibold text-theme-text-primary hover:bg-theme-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAccount}
                    className="flex-1 rounded-lg bg-theme-accent px-4 py-2 text-sm font-semibold text-theme-text-primary hover:bg-theme-accent-hover flex items-center justify-center gap-2"
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
