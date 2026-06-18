"use client";

import { useEffect, useState } from "react";
import { FormAlert } from "@/components/form";
import { Plus, Download, Eye, Edit, Trash2, CheckCircle, XCircle, Filter, MoreVertical, RefreshCw, Receipt } from "lucide-react";
import {
  SubmitExpenseModal,
  ViewExpenseModal,
  BulkActionsModal,
  ExportExpensesModal,
} from "./expenses-modals";
import {
  listExpenses,
  approveExpense,
  deleteExpense,
} from "@/lib/api/expenses";

type Expense = {
  id: string;
  category: string;
  amount: number;
  status: string;
  description: string;
  employee?: string;
  submittedDate?: string;
  notes?: string;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-800",
  submitted: "bg-blue-500/10 text-blue-400",
  approved: "bg-green-500/10 text-green-400",
  rejected: "bg-red-500/10 text-red-400",
  reimbursed: "bg-[rgba(99,102,241,0.1)] text-[#818CF8]",
};

export default function ExpensesSection({ tenantSlug }: { tenantSlug?: string | null }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  
  // Modal states
  const [showSubmitExpense, setShowSubmitExpense] = useState(false);
  const [showViewExpense, setShowViewExpense] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showExportExpenses, setShowExportExpenses] = useState(false);
  
  // Selection and filtering
  const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(new Set());
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Loading states
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [approvingExpense, setApprovingExpense] = useState(false);
  const [rejectingExpense, setRejectingExpense] = useState(false);
  const [processingBulk, setProcessingBulk] = useState(false);
  const [exporting, setExporting] = useState(false);

  const ts = tenantSlug ;

  // Initialize last refreshed on mount
  useEffect(() => {
    setLastRefreshed(new Date());
  }, []);

  // Auto-dismiss alerts after 3.5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Map backend expense to frontend shape
  function mapBackendExpense(raw: any): Expense {
    const approvalStatus = (raw.approvalStatus || raw.approval_status || "PENDING").toString().toLowerCase();
    const statusMap: Record<string, string> = {
      pending: "submitted",
      approved: "approved",
      rejected: "rejected",
      draft: "draft",
      clarify_needed: "submitted",
    };
    return {
      id: raw.id,
      category: raw.category || raw.categoryId || "other",
      amount: typeof raw.totalAmount === "number" ? raw.totalAmount : (typeof raw.amount === "number" ? raw.amount : 0),
      status: statusMap[approvalStatus] || approvalStatus,
      description: raw.description || "",
      employee: raw.createdBy || raw.created_by || "Current User",
      submittedDate: raw.createdAt || raw.created_at || raw.date || new Date().toISOString(),
      notes: raw.notes || undefined,
    };
  }

  // Load expenses from API
  async function loadExpenses() {
    if (!ts) return;
    setLoading(true);
    try {
      const response = await listExpenses({ tenantSlug: ts, limit: 100 });
      const rawExpenses = (response as any)?.expenses || [];
      setExpenses(rawExpenses.map(mapBackendExpense));
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Failed to load expenses:", err);
      setError("Failed to load expenses from server");
    } finally {
      setLoading(false);
    }
  }

  // Refresh expenses data
  const handleRefreshExpenses = async () => {
    await loadExpenses();
    setSuccess("Expenses refreshed successfully");
  };

  // Load on mount
  useEffect(() => {
    loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ts]);

  // Filter expenses
  const filteredExpenses = expenses.filter((exp) => {
    if (statusFilter !== "all" && exp.status !== statusFilter) return false;
    if (categoryFilter !== "all" && exp.category !== categoryFilter) return false;
    if (searchQuery && !exp.id.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !exp.description.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !exp.employee?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Handler: Submit new expense
  async function handleSubmitExpense(data: any) {
    setSubmittingExpense(true);
    try {
      // Modal already created the expense via API; just refresh the list
      await loadExpenses();
      setSuccess("Expense submitted successfully");
      setShowSubmitExpense(false);
    } catch (err) {
      setError("Failed to submit expense");
    } finally {
      setSubmittingExpense(false);
    }
  }

  // Handler: View expense
  function handleViewExpense(expense: Expense) {
    setSelectedExpense(expense);
    setShowViewExpense(true);
  }

  // Handler: Approve expense
  async function handleApproveExpense() {
    if (!selectedExpense || !ts) return;
    setApprovingExpense(true);
    try {
      await approveExpense({
        expenseId: selectedExpense.id,
        tenantSlug: ts,
        action: "approved",
        approverRole: "MANAGER",
        approverId: "current-user",
        approverName: "Manager",
      });
      await loadExpenses();
      setSuccess("Expense approved");
      setShowViewExpense(false);
      setSelectedExpense(null);
    } catch (err) {
      console.error(err);
      setError("Failed to approve expense");
    } finally {
      setApprovingExpense(false);
    }
  }

  // Handler: Reject expense
  async function handleRejectExpense() {
    if (!selectedExpense || !ts) return;
    setRejectingExpense(true);
    try {
      await approveExpense({
        expenseId: selectedExpense.id,
        tenantSlug: ts,
        action: "rejected",
        approverRole: "MANAGER",
        approverId: "current-user",
        approverName: "Manager",
      });
      await loadExpenses();
      setSuccess("Expense rejected");
      setShowViewExpense(false);
      setSelectedExpense(null);
    } catch (err) {
      console.error(err);
      setError("Failed to reject expense");
    } finally {
      setRejectingExpense(false);
    }
  }

  // Handler: Delete expense
  async function handleDeleteExpense(id: string) {
    if (!confirm("Delete this expense? This action cannot be undone.")) return;
    if (!ts) return;
    try {
      await deleteExpense(id, ts);
      await loadExpenses();
      setSuccess("Expense deleted");
    } catch (err) {
      console.error(err);
      setError("Failed to delete expense");
    }
  }

  // Handler: Bulk approve
  async function handleBulkApprove() {
    if (!ts) return;
    setProcessingBulk(true);
    try {
      const selectedIds = Array.from(selectedExpenses);
      for (const id of selectedIds) {
        await approveExpense({
          expenseId: id,
          tenantSlug: ts,
          action: "approved",
          approverRole: "MANAGER",
          approverId: "current-user",
          approverName: "Manager",
        });
      }
      await loadExpenses();
      setSelectedExpenses(new Set());
      setShowBulkActions(false);
      setSuccess(`${selectedIds.length} expense(s) approved`);
    } catch (err) {
      console.error(err);
      setError("Failed to approve expenses");
    } finally {
      setProcessingBulk(false);
    }
  }

  // Handler: Bulk reject
  async function handleBulkReject() {
    if (!ts) return;
    setProcessingBulk(true);
    try {
      const selectedIds = Array.from(selectedExpenses);
      for (const id of selectedIds) {
        await approveExpense({
          expenseId: id,
          tenantSlug: ts,
          action: "rejected",
          approverRole: "MANAGER",
          approverId: "current-user",
          approverName: "Manager",
        });
      }
      await loadExpenses();
      setSelectedExpenses(new Set());
      setShowBulkActions(false);
      setSuccess(`${selectedIds.length} expense(s) rejected`);
    } catch (err) {
      console.error(err);
      setError("Failed to reject expenses");
    } finally {
      setProcessingBulk(false);
    }
  }

  // Handler: Export expenses
  async function handleExportExpenses(format: string) {
    setExporting(true);
    try {
      const dataToExport = filteredExpenses;
      let content = "";
      const filename = `expenses-${new Date().toISOString().split("T")[0]}`;

      if (format === "csv") {
        const headers = ["ID", "Category", "Amount", "Status", "Employee", "Date"];
        const rows = dataToExport.map((e) => [
          e.id,
          e.category,
          e.amount,
          e.status,
          e.employee,
          e.submittedDate,
        ]);
        content = [headers, ...rows].map((r) => r.map((cell) => `"${cell}"`).join(",")).join("\n");
      } else if (format === "excel") {
        // Simple Excel-like format (would use xlsx library in production)
        content = `ID\tCategory\tAmount\tStatus\tEmployee\tDate\n`;
        content += dataToExport.map((e) => `${e.id}\t${e.category}\t${e.amount}\t${e.status}\t${e.employee}\t${e.submittedDate}`).join("\n");
      }

      const blob = new Blob([content], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess("Expenses exported successfully");
      setShowExportExpenses(false);
    } catch (err) {
      setError("Failed to export expenses");
    } finally {
      setExporting(false);
    }
  }

  const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const pendingCount = filteredExpenses.filter((e) => e.status === "submitted" || e.status === "pending").length;

  return (
    <div className="space-y-6">
      {error && <FormAlert type="error" title="Error" message={error} onClose={() => setError(null)} />}
      {success && <FormAlert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Header with Refresh Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#F8FAFC]">Expense Management</h2>
          {lastRefreshed && (
            <p className="text-xs text-slate-500 mt-1">
              Last updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <button
          onClick={handleRefreshExpenses}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-slate-200 bg-[#111827] p-4">
          <p className="text-sm text-slate-600">Total Expenses</p>
          <p className="mt-2 text-2xl font-bold text-[#F8FAFC]">₦{totalAmount.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-[#111827] p-4">
          <p className="text-sm text-slate-600">Pending Approval</p>
          <p className="mt-2 text-2xl font-bold text-orange-600">{pendingCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-[#111827] p-4">
          <p className="text-sm text-slate-600">Approved</p>
          <p className="mt-2 text-2xl font-bold text-green-400">{expenses.filter((e) => e.status === "approved").length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-[#111827] p-4">
          <p className="text-sm text-slate-600">Rejected</p>
          <p className="mt-2 text-2xl font-bold text-red-400">{expenses.filter((e) => e.status === "rejected").length}</p>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="rounded-lg border border-slate-200 bg-[#111827] p-4">
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#0B1120] rounded-lg border border-[rgba(255,255,255,0.1)] px-3 py-2 text-sm text-white"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="reimbursed">Reimbursed</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-[#0B1120] rounded-lg border border-[rgba(255,255,255,0.1)] px-3 py-2 text-sm text-white"
            >
              <option value="all">All Categories</option>
              <option value="travel">Travel</option>
              <option value="meals">Meals</option>
              <option value="office">Office Supplies</option>
              <option value="software">Software</option>
              <option value="training">Training</option>
              <option value="other">Other</option>
            </select>
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2 justify-end">
            {selectedExpenses.size > 0 && (
              <button
                onClick={() => setShowBulkActions(true)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Bulk Actions ({selectedExpenses.size})
              </button>
            )}
            <button
              onClick={() => setShowExportExpenses(true)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={() => setShowSubmitExpense(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Submit Expense
            </button>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="rounded-lg border border-slate-200 bg-[#111827] overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg animate-pulse">
                <div className="w-4 h-4 bg-slate-300 rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-300 rounded w-24"></div>
                  <div className="h-3 bg-slate-300 rounded w-32"></div>
                </div>
                <div className="h-4 bg-slate-300 rounded w-20"></div>
                <div className="h-4 bg-slate-300 rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium mb-2">No expenses found</p>
            <p className="text-sm text-slate-500 mb-4">
              {searchQuery || statusFilter !== "all" || categoryFilter !== "all"
                ? "Try adjusting your filters or search query"
                : "Submit your first expense to get started"}
            </p>
            {!searchQuery && statusFilter === "all" && categoryFilter === "all" && (
              <button
                onClick={() => setShowSubmitExpense(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Submit Expense
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedExpenses.size === filteredExpenses.length && filteredExpenses.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedExpenses(new Set(filteredExpenses.map((e) => e.id)));
                        } else {
                          setSelectedExpenses(new Set());
                        }
                      }}
                      className="bg-white rounded border-slate-300 text-black"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedExpenses.has(expense.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedExpenses);
                        if (e.target.checked) {
                          newSelected.add(expense.id);
                        } else {
                          newSelected.delete(expense.id);
                        }
                        setSelectedExpenses(newSelected);
                      }}
                      className="bg-white rounded border-slate-300 text-black"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-[#F8FAFC]">{expense.id}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 capitalize">{expense.category}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-[#F8FAFC]">₦{expense.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{expense.employee}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[expense.status] || "bg-[rgba(255,255,255,0.07)]"}`}>
                      {expense.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleViewExpense(expense)}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <SubmitExpenseModal
        isOpen={showSubmitExpense}
        onClose={() => setShowSubmitExpense(false)}
        onSubmit={handleSubmitExpense}
        isLoading={submittingExpense}
        tenantSlug={ts}
      />

      <ViewExpenseModal
        isOpen={showViewExpense}
        onClose={() => {
          setShowViewExpense(false);
          setSelectedExpense(null);
        }}
        expense={selectedExpense}
        onApprove={handleApproveExpense}
        onReject={handleRejectExpense}
      />

      <BulkActionsModal
        isOpen={showBulkActions}
        onClose={() => setShowBulkActions(false)}
        onApproveAll={handleBulkApprove}
        onRejectAll={handleBulkReject}
        count={selectedExpenses.size}
        isLoading={processingBulk}
      />

      <ExportExpensesModal
        isOpen={showExportExpenses}
        onClose={() => setShowExportExpenses(false)}
        onExport={handleExportExpenses}
        isLoading={exporting}
      />
    </div>
  );
}
