"use client";

import React, { useEffect, useState } from "react";
import { Plus, Download, Filter, Grid3X3, List, Search, X, Edit2, AlertCircle } from "lucide-react";
import NewAccountModal from "./NewAccountModal";

type Account = {
  id: string;
  tenantSlug: string;
  regionId: string;
  branchId: string;
  name: string;
  primaryContact?: any;
  status?: string;
  createdAt?: string;
};

type ViewType = "table" | "grid";

const ACCOUNT_STATUSES = ["active", "inactive", "prospect", "archived"];

export default function AccountsPage({ tenantSlug, regionId }: { tenantSlug?: string | null; regionId?: string | null }) {
  const ts = tenantSlug ;
  const rid = regionId ?? undefined;
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(12);
  const [total, setTotal] = useState<number | null>(null);
  const totalPages = total !== null ? Math.max(1, Math.ceil(total / pageSize)) : null;

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  // UI
  const [viewType, setViewType] = useState<ViewType>("table");
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const loadAccounts = (p = page, size = pageSize) => {
    setLoading(true);
    setError(null);
    const offset = p * size;
    const params = new URLSearchParams({
      tenantSlug: ts,
      limit: String(size),
      ...(rid && { regionId: rid }),
    });

    fetch(`/api/crm/customers?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setAccounts(Array.isArray(data.customers) ? data.customers : []);
        setTotal(data.total || 0);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load accounts");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAccounts(0, pageSize);
  }, [ts, rid]);

  const handleUpdate = async (id: string, updates: Partial<Account>) => {
    try {
      const res = await fetch(`/api/crm/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        setSuccess("Account updated successfully");
        setShowEditModal(false);
        setSelectedAccount(null);
        loadAccounts(page, pageSize);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError("Failed to update account");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating account");
    }
  };

  const handleCreateAccount = async (accountData: any) => {
    try {
      const res = await fetch("/api/crm/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: ts,
          ...accountData,
        }),
      });

      if (res.ok) {
        setSuccess("Account created successfully");
        setShowNewModal(false);
        loadAccounts(0, pageSize);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const err = await res.json();
        setError(err.error?.contactEmail?.[0] || "Failed to create account");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating account");
    }
  };

  const filteredAccounts = accounts.filter((account) => {
    if (searchTerm && !account.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterStatus !== "all" && account.status !== filterStatus) {
      return false;
    }
    return true;
  });

  const handleExportAccounts = () => {
    const headers = ["Account Name", "Primary Contact", "Email", "Phone", "Status", "Created"];
    const data = filteredAccounts.map((a) => [
      a.name,
      a.primaryContact?.name || "-",
      a.primaryContact?.email || "-",
      a.primaryContact?.phone || "-",
      a.status || "active",
      new Date(a.createdAt ?? "").toLocaleDateString(),
    ]);

    const csv = [headers, ...data].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accounts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading && accounts.length === 0) {
    return <div className="flex items-center justify-center h-96">Loading accounts...</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-6 bg-white rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Accounts</h2>
          <p className="text-sm text-gray-600">Manage your customer accounts</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportAccounts}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            New Account
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by account name..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0);
                }}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(0);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            {ACCOUNT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>

          <div className="flex gap-1 border border-gray-300 rounded-lg p-1 bg-white">
            <button
              onClick={() => setViewType("table")}
              className={`p-2 rounded ${viewType === "table" ? "bg-gray-200" : "hover:bg-gray-100"}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewType("grid")}
              className={`p-2 rounded ${viewType === "grid" ? "bg-gray-200" : "hover:bg-gray-100"}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {filteredAccounts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No accounts found</p>
        </div>
      ) : viewType === "table" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b border-gray-300">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Account Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Primary Contact</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Phone</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Status</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAccounts.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{account.name}</td>
                  <td className="px-4 py-3 text-gray-700">{account.primaryContact?.name || "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{account.primaryContact?.email || "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{account.primaryContact?.phone || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                      account.status === "active" ? "bg-green-100 text-green-800" :
                      account.status === "inactive" ? "bg-gray-100 text-gray-800" :
                      account.status === "prospect" ? "bg-blue-100 text-blue-800" :
                      "bg-yellow-100 text-yellow-800"
                    }`}>
                      {(account.status || "Active").charAt(0).toUpperCase() + (account.status || "Active").slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => {
                        setSelectedAccount(account);
                        setShowEditModal(true);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccounts.map((account) => (
            <div key={account.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-gray-900">{account.name}</h3>
                <button
                  onClick={() => {
                    setSelectedAccount(account);
                    setShowEditModal(true);
                  }}
                  className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2 text-sm text-gray-600 mb-3">
                {account.primaryContact?.name && <p className="font-medium">{account.primaryContact.name}</p>}
                {account.primaryContact?.email && <p>📧 {account.primaryContact.email}</p>}
                {account.primaryContact?.phone && <p>📱 {account.primaryContact.phone}</p>}
              </div>
              <div className="flex justify-between items-center">
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                  account.status === "active" ? "bg-green-100 text-green-800" :
                  account.status === "inactive" ? "bg-gray-100 text-gray-800" :
                  account.status === "prospect" ? "bg-blue-100 text-blue-800" :
                  "bg-yellow-100 text-yellow-800"
                }`}>
                  {(account.status || "Active").charAt(0).toUpperCase() + (account.status || "Active").slice(1)}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(account.createdAt ?? "").toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages !== null && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <div className="text-sm text-gray-600">
            Page {page + 1} of {totalPages} ({total} total)
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showNewModal && <NewAccountModal onClose={() => setShowNewModal(false)} onSave={handleCreateAccount} />}
      {showEditModal && selectedAccount && (
        <NewAccountModal
          isEdit
          initialData={selectedAccount}
          onClose={() => {
            setShowEditModal(false);
            setSelectedAccount(null);
          }}
          onSave={(data) => handleUpdate(selectedAccount.id, data)}
        />
      )}
    </div>
  );
}
