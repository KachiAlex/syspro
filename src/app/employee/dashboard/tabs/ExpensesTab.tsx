'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Plus, CheckCircle, XCircle, Clock, DollarSign,
  AlertCircle, X, Receipt
} from 'lucide-react';

interface EmployeeProfile {
  id: string; name: string; email: string; jobTitle: string; role: string;
  departmentId: string; employmentType: string; status: string;
  hireDate: string; salary: number; lastLogin: string;
}

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  status: string;
  approver_comment?: string;
  approver_name?: string;
  created_at: string;
  employee_name?: string;
  employee_job_title?: string;
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
  approved: { color: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle className="w-3 h-3" />, label: 'Approved' },
  rejected: { color: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle className="w-3 h-3" />, label: 'Rejected' },
  paid: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <DollarSign className="w-3 h-3" />, label: 'Paid' },
};

const CATEGORIES = ['Travel', 'Meals', 'Office Supplies', 'Software', 'Equipment', 'Training', 'Transportation', 'Communication', 'Miscellaneous'];

export function ExpensesTab({ profile }: { profile: EmployeeProfile }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHOD, setIsHOD] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  const employeeRole = (profile.role || 'staff').toLowerCase();
  const canApprove = ['hod', 'head_of_department', 'hr', 'hr_admin', 'hr_manager'].includes(employeeRole);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hr/employees/portal/expenses');
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setExpenses(data.expenses || []);
        setPendingApprovals(data.pendingApprovals || []);
        setIsHOD(data.isHOD || false);
      } else {
        setError(data.error || 'Failed to load expenses');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const handleApprove = async (expenseId: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch('/api/hr/employees/portal/expenses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenseId, action }),
      });
      if (res.ok) {
        loadExpenses();
      }
    } catch {}
  };

  const filtered = expenses.filter(e => filterStatus === 'all' || e.status === filterStatus);
  const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const pendingCount = expenses.filter(e => e.status === 'pending').length;
  const approvedCount = expenses.filter(e => e.status === 'approved').length;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Expense Requests</h2>
          <p className="text-sm text-gray-500 mt-0.5">Submit and track your expense reimbursements</p>
        </div>
        <button
          onClick={() => setShowSubmit(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Expense
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 mb-2">
            <Receipt className="w-4 h-4" /> Total
          </div>
          <p className="text-2xl font-bold text-gray-900">{expenses.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-700 mb-2">
            <Clock className="w-4 h-4" /> Pending
          </div>
          <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700 mb-2">
            <CheckCircle className="w-4 h-4" /> Approved
          </div>
          <p className="text-2xl font-bold text-gray-900">{approvedCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-blue-100 text-blue-700 mb-2">
            <DollarSign className="w-4 h-4" /> Total Amount
          </div>
          <p className="text-2xl font-bold text-gray-900">₦{totalAmount.toLocaleString()}</p>
        </div>
      </div>

      {/* Pending approvals (HOD only) */}
      {canApprove && pendingApprovals.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-3">Pending Approvals ({pendingApprovals.length})</h3>
          <div className="space-y-2">
            {pendingApprovals.map(exp => (
              <div key={exp.id} className="bg-white rounded-xl border border-amber-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="font-semibold text-gray-900 text-sm">{exp.category}</h4>
                      <span className="text-xs text-gray-500">by {exp.employee_name}</span>
                    </div>
                    <p className="text-sm text-gray-600">{exp.description}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      <span>₦{Number(exp.amount).toLocaleString()}</span>
                      <span>{exp.date}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleApprove(exp.id, 'approve')}
                      className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleApprove(exp.id, 'reject')}
                      className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {['all', 'pending', 'approved', 'rejected', 'paid'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              filterStatus === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Expense list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200">
          <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No expense requests yet. Submit one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(exp => {
            const cfg = STATUS_CONFIG[exp.status] || STATUS_CONFIG.pending;
            return (
              <div key={exp.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="font-semibold text-gray-900 text-sm">{exp.category}</h4>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${cfg.color}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{exp.description}</p>
                    {exp.approver_comment && (
                      <p className="text-xs text-gray-500 mt-1.5 italic">"{exp.approver_comment}"</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      <span className="font-medium text-gray-700">₦{Number(exp.amount).toLocaleString()}</span>
                      <span>{exp.date}</span>
                      {exp.approver_name && <span>Reviewed by: {exp.approver_name}</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submit Expense Modal */}
      {showSubmit && (
        <SubmitExpenseModal
          onClose={() => setShowSubmit(false)}
          onSubmitted={() => { setShowSubmit(false); loadExpenses(); }}
        />
      )}
    </div>
  );
}

function SubmitExpenseModal({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: () => void }) {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!category || !description || !amount) {
      setError('Please fill in all required fields');
      return;
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/hr/employees/portal/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, description, amount: amt, date }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onSubmitted();
      } else {
        setError(data.error || 'Failed to submit expense');
      }
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">New Expense Request</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Category *</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select category...</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Description *</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Describe the expense..."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Amount (₦) *</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Date *</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
