'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Download, FileText, Database, TrendingUp, Calculator, Eye, Edit, RefreshCw } from 'lucide-react';
import { UnifiedReportModal } from '../components/unified-report-modal';
import { ReportService } from '../services/report-service';

interface Accounting {
  tenantSlug: string;
}

interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  reference_type: string;
  description: string;
  lines: Array<{
    account_code: string;
    account_name: string;
    debit_amount: number;
    credit_amount: number;
  }>;
}

interface ChartOfAccountItem {
  code: string;
  name: string;
  type: string;
  balance: number;
}

interface AccountingSummary {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  cashBalance: number;
}

const AccountingComponent: React.FC<Accounting> = ({ tenantSlug }) => {
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccountItem[]>([]);
  const [summary, setSummary] = useState<AccountingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const ts = encodeURIComponent(tenantSlug);
      const [jeRes, coaRes, pnlRes, bsRes] = await Promise.all([
        fetch(`/api/finance/journal-entries?tenantSlug=${ts}&limit=10`).then(r => r.json()).catch(() => ({ success: false, data: [] })),
        fetch(`/api/finance/chart-of-accounts?tenantSlug=${ts}`).then(r => r.json()).catch(() => ({ success: false, data: [] })),
        fetch(`/api/finance/reports/pnl?tenantSlug=${ts}`).then(r => r.json()).catch(() => ({ success: false, data: null })),
        fetch(`/api/finance/reports/balance-sheet?tenantSlug=${ts}`).then(r => r.json()).catch(() => ({ success: false, data: null })),
      ]);

      if (jeRes.success) setJournalEntries(jeRes.data || []);
      if (coaRes.success) setChartOfAccounts(coaRes.data || []);

      const pnl = pnlRes.success ? pnlRes.data : null;
      const bs = bsRes.success ? bsRes.data : null;

      if (pnl) {
        const cashAccount = bs?.assets?.find((a: any) => a.code === '1100' || a.code === '1110');
        setSummary({
          totalRevenue: pnl.totalRevenue || 0,
          totalExpenses: pnl.totalExpenses || 0,
          netIncome: pnl.netIncome || 0,
          cashBalance: cashAccount?.balance || 0,
        });
      }
    } catch (err) {
      console.error('Failed to load accounting data:', err);
      setAlert({ type: 'error', message: 'Failed to load accounting data' });
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerateReport = async (reportData: any) => {
    try {
      const report = await ReportService.generateReport({
        module: 'financial',
        reportType: reportData.reportType,
        dateRange: reportData.dateRange,
        format: reportData.format,
        includeCharts: reportData.includeCharts,
        filters: reportData.filters,
        tenantSlug
      });

      setAlert({ type: 'success', message: `${reportData.reportType} report generated successfully!` });
      setShowReportModal(false);
    } catch (error) {
      console.error('Failed to generate report:', error);
      setAlert({ type: 'error', message: 'Failed to generate report. Please try again.' });
    }
  };

  const handleExportData = async () => {
    try {
      const ts = encodeURIComponent(tenantSlug);
      const res = await fetch(`/api/finance/reports/trial-balance?tenantSlug=${ts}&format=csv`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trial-balance-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        setAlert({ type: 'success', message: 'Trial balance exported successfully!' });
      } else {
        setAlert({ type: 'error', message: 'Failed to export data' });
      }
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to export data' });
    }
  };

  const formatCurrency = (amount?: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount || 0);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  const assets = chartOfAccounts.filter(a => a.type === 'asset');
  const liabilities = chartOfAccounts.filter(a => a.type === 'liability');
  const equity = chartOfAccounts.filter(a => a.type === 'equity');

  return (
    <div className="p-6">
      {alert && (
        <div className={`mb-4 p-4 rounded-lg border ${
          alert.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {alert.message}
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-black mb-2">Accounting Workspace</h2>
          <p className="text-black">Manage journal entries, financial reports, and chart of accounts</p>
        </div>
        <button onClick={loadData} className="p-2 rounded-lg border border-theme-border hover:bg-theme-sidebar-hover">
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-theme-muted rounded-xl border border-theme-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Total Revenue</p>
              <p className="text-xl font-bold text-black">{loading ? '...' : formatCurrency(summary?.totalRevenue)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-400" />
          </div>
        </div>
        <div className="bg-theme-muted rounded-xl border border-theme-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Total Expenses</p>
              <p className="text-xl font-bold text-black">{loading ? '...' : formatCurrency(summary?.totalExpenses)}</p>
            </div>
            <Calculator className="w-8 h-8 text-red-400" />
          </div>
        </div>
        <div className="bg-theme-muted rounded-xl border border-theme-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Net Income</p>
              <p className="text-xl font-bold text-black">{loading ? '...' : formatCurrency(summary?.netIncome)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-theme-accent" />
          </div>
        </div>
        <div className="bg-theme-muted rounded-xl border border-theme-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Cash Balance</p>
              <p className="text-xl font-bold text-black">{loading ? '...' : formatCurrency(summary?.cashBalance)}</p>
            </div>
            <Database className="w-8 h-8 text-theme-accent" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-theme-muted rounded-xl border border-theme-border p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setShowJournalModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2 inline" />
            Journal Entry
          </button>
          <button onClick={() => setShowReportModal(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            <FileText className="w-4 h-4 mr-2 inline" />
            Generate Report
          </button>
          <button onClick={() => setShowChartModal(true)} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            <Database className="w-4 h-4 mr-2 inline" />
            Chart of Accounts
          </button>
          <button onClick={handleExportData} className="px-4 py-2 border border-theme-border text-theme-text-primary rounded-lg hover:bg-theme-sidebar-hover">
            <Download className="w-4 h-4 mr-2 inline" />
            Export Trial Balance
          </button>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-black mb-4">Income Statement (YTD)</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-black">Revenue</span>
              <span className="font-semibold text-black">{formatCurrency(summary?.totalRevenue)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-black">Total Expenses</span>
              <span className="font-semibold text-black">{formatCurrency(summary?.totalExpenses)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="font-bold text-black">Net Income</span>
              <span className="font-bold text-lg text-green-400">{formatCurrency(summary?.netIncome)}</span>
            </div>
          </div>
        </div>

        <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-black mb-4">Balance Sheet Summary</h3>
          <div className="space-y-3">
            <div className="border-b pb-3">
              <h4 className="font-medium text-black mb-2">Assets</h4>
              {assets.length > 0 ? assets.slice(0, 3).map((a) => (
                <div key={a.code} className="flex justify-between text-sm mb-1">
                  <span className="text-black">{a.name}</span>
                  <span className="text-black">{formatCurrency(a.balance)}</span>
                </div>
              )) : <p className="text-sm text-gray-400">No asset accounts</p>}
            </div>
            <div>
              <h4 className="font-medium text-black mb-2">Liabilities & Equity</h4>
              {liabilities.length > 0 ? liabilities.slice(0, 2).map((l) => (
                <div key={l.code} className="flex justify-between text-sm mb-1">
                  <span className="text-black">{l.name}</span>
                  <span className="text-black">{formatCurrency(l.balance)}</span>
                </div>
              )) : <p className="text-sm text-gray-400">No liability accounts</p>}
              {equity.length > 0 ? equity.slice(0, 1).map((e) => (
                <div key={e.code} className="flex justify-between font-semibold text-sm border-t pt-1">
                  <span className="text-black">{e.name}</span>
                  <span className="text-black">{formatCurrency(e.balance)}</span>
                </div>
              )) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Journal Entries */}
      <div className="bg-theme-muted rounded-xl border border-theme-border p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-black">Recent Journal Entries</h3>
          <button className="text-theme-accent hover:text-blue-800 text-sm">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-tertiary uppercase">Entry #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-tertiary uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-tertiary uppercase">Reference</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-tertiary uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-tertiary uppercase">Lines</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-tertiary uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {journalEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    {loading ? 'Loading...' : 'No journal entries found'}
                  </td>
                </tr>
              ) : journalEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-theme-sidebar-hover">
                  <td className="px-4 py-3 text-black">{entry.entry_number}</td>
                  <td className="px-4 py-3 text-black">{formatDate(entry.entry_date)}</td>
                  <td className="px-4 py-3 text-black">{entry.reference_type}</td>
                  <td className="px-4 py-3 text-black">{entry.description}</td>
                  <td className="px-4 py-3 text-black">{entry.lines?.length || 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="text-theme-accent"><Eye className="w-4 h-4" /></button>
                      <button className="text-green-400"><Edit className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart of Accounts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-black mb-4">Assets</h3>
          <div className="space-y-2 text-sm">
            {assets.length > 0 ? assets.map((a) => (
              <div key={a.code} className="flex justify-between py-2 border-b">
                <span className="text-black">{a.name}</span>
                <span className="font-semibold text-black">{formatCurrency(a.balance)}</span>
              </div>
            )) : <p className="text-gray-400">No asset accounts</p>}
          </div>
        </div>

        <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-black mb-4">Liabilities</h3>
          <div className="space-y-2 text-sm">
            {liabilities.length > 0 ? liabilities.map((l) => (
              <div key={l.code} className="flex justify-between py-2 border-b">
                <span className="text-black">{l.name}</span>
                <span className="font-semibold text-black">{formatCurrency(l.balance)}</span>
              </div>
            )) : <p className="text-gray-400">No liability accounts</p>}
          </div>
        </div>

        <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-black mb-4">Equity</h3>
          <div className="space-y-2 text-sm">
            {equity.length > 0 ? equity.map((e) => (
              <div key={e.code} className="flex justify-between py-2 border-b">
                <span className="text-black">{e.name}</span>
                <span className="font-semibold text-black">{formatCurrency(e.balance)}</span>
              </div>
            )) : <p className="text-gray-400">No equity accounts</p>}
          </div>
        </div>
      </div>

      {alert && (
        <div className="fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white font-medium bg-green-600">
          {alert.message}
        </div>
      )}

      {/* Unified Report Modal */}
      <UnifiedReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        module="financial"
        tenantSlug={tenantSlug}
        onReportGenerated={(report) => {
          setAlert({ type: 'success', message: `${report.type} report generated successfully!` });
        }}
      />

      {/* Journal Entry Modal */}
      {showJournalModal && (
        <JournalEntryModal
          tenantSlug={tenantSlug}
          onClose={() => setShowJournalModal(false)}
          onSuccess={() => {
            setAlert({ type: 'success', message: 'Journal entry created successfully!' });
            setShowJournalModal(false);
            loadData();
          }}
        />
      )}

      {/* Chart of Accounts Modal */}
      {showChartModal && (
        <ChartOfAccountsModal
          tenantSlug={tenantSlug}
          onClose={() => setShowChartModal(false)}
        />
      )}
    </div>
  );
};

function JournalEntryModal({ tenantSlug, onClose, onSuccess }: {
  tenantSlug: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState([
    { accountCode: '', debitAmount: 0, creditAmount: 0 },
    { accountCode: '', debitAmount: 0, creditAmount: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalDebit = lines.reduce((s, l) => s + Number(l.debitAmount || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.creditAmount || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const handleSave = async () => {
    setError(null);
    if (!description.trim()) {
      setError('Description is required');
      return;
    }
    if (!isBalanced) {
      setError('Debits and credits must be equal');
      return;
    }
    if (lines.some(l => !l.accountCode)) {
      setError('All lines must have an account code');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/finance/journal-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug,
          entryDate,
          description,
          referenceType: 'manual',
          lines: lines.map(l => ({
            accountCode: l.accountCode,
            debitAmount: Number(l.debitAmount || 0),
            creditAmount: Number(l.creditAmount || 0),
          })),
        }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Failed to create journal entry');
      }
    } catch (err) {
      setError('Failed to create journal entry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Create Journal Entry</h3>
          {error && <div className="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Entry description" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Lines</label>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-1">Account Code</th>
                    <th className="text-right py-1">Debit</th>
                    <th className="text-right py-1">Credit</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i}>
                      <td className="py-1">
                        <input type="text" value={line.accountCode} onChange={e => {
                          const newLines = [...lines];
                          newLines[i].accountCode = e.target.value;
                          setLines(newLines);
                        }} className="w-full border rounded px-2 py-1" placeholder="e.g. 1100" />
                      </td>
                      <td className="py-1">
                        <input type="number" value={line.debitAmount || ''} onChange={e => {
                          const newLines = [...lines];
                          newLines[i].debitAmount = Number(e.target.value);
                          setLines(newLines);
                        }} className="w-full border rounded px-2 py-1 text-right" />
                      </td>
                      <td className="py-1">
                        <input type="number" value={line.creditAmount || ''} onChange={e => {
                          const newLines = [...lines];
                          newLines[i].creditAmount = Number(e.target.value);
                          setLines(newLines);
                        }} className="w-full border rounded px-2 py-1 text-right" />
                      </td>
                      <td className="py-1">
                        {lines.length > 2 && (
                          <button onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="text-red-500 text-xs">Remove</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-semibold">
                    <td className="py-2">Totals</td>
                    <td className="py-2 text-right">{totalDebit.toFixed(2)}</td>
                    <td className="py-2 text-right">{totalCredit.toFixed(2)}</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan={4} className={`text-xs ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                      {isBalanced ? 'Balanced' : 'Not balanced'}
                    </td>
                  </tr>
                </tfoot>
              </table>
              <button onClick={() => setLines([...lines, { accountCode: '', debitAmount: 0, creditAmount: 0 }])} className="text-sm text-blue-600 mt-2">
                + Add Line
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={onClose} className="px-4 py-2 border rounded-lg">Cancel</button>
            <button onClick={handleSave} disabled={saving || !isBalanced} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartOfAccountsModal({ tenantSlug, onClose }: {
  tenantSlug: string;
  onClose: () => void;
}) {
  const [accounts, setAccounts] = useState<ChartOfAccountItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/finance/chart-of-accounts?tenantSlug=${encodeURIComponent(tenantSlug)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setAccounts(data.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tenantSlug]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Chart of Accounts</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">x</button>
          </div>
          {loading ? (
            <p className="text-center py-8 text-gray-400">Loading...</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left">Code</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {accounts.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No accounts found</td></tr>
                ) : accounts.map((a) => (
                  <tr key={a.code}>
                    <td className="px-4 py-2 font-mono">{a.code}</td>
                    <td className="px-4 py-2">{a.name}</td>
                    <td className="px-4 py-2 capitalize">{a.type}</td>
                    <td className="px-4 py-2 text-right">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(a.balance || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default AccountingComponent;
