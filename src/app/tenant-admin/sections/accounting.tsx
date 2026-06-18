'use client';

import React, { useState } from 'react';
import { Plus, Download, FileText, Database, TrendingUp, Calculator, Eye, Edit } from 'lucide-react';
import { UnifiedReportModal } from '../components/unified-report-modal';
import { ReportService } from '../services/report-service';

interface Accounting {
  tenantSlug: string;
}

const AccountingComponent: React.FC<Accounting> = ({ tenantSlug }) => {
  const [journalEntries] = useState([]);

  const [alert, setAlert] = useState<{ type: 'success' | 'info'; message: string } | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

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
      setAlert({ type: 'info', message: 'Failed to generate report. Please try again.' });
    }
  };

  const handleExportData = () => {
    setAlert({ type: 'success', message: 'Financial data exported successfully!' });
  };

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

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-black mb-2">Accounting Workspace</h2>
        <p className="text-black">Manage journal entries, financial reports, and chart of accounts</p>
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Total Revenue</p>
              <p className="text-xl font-bold text-black">$234,567</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-400" />
          </div>
        </div>
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Total Expenses</p>
              <p className="text-xl font-bold text-black">$145,890</p>
            </div>
            <Calculator className="w-8 h-8 text-red-400" />
          </div>
        </div>
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Net Income</p>
              <p className="text-xl font-bold text-black">$88,677</p>
            </div>
            <TrendingUp className="w-8 h-8 text-[#818CF8]" />
          </div>
        </div>
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Cash Balance</p>
              <p className="text-xl font-bold text-black">$67,234</p>
            </div>
            <Database className="w-8 h-8 text-[#818CF8]" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2 inline" />
            Journal Entry
          </button>
          <button onClick={() => setShowReportModal(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            <FileText className="w-4 h-4 mr-2 inline" />
            Generate Report
          </button>
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            <Database className="w-4 h-4 mr-2 inline" />
            Chart of Accounts
          </button>
          <button onClick={handleExportData} className="px-4 py-2 border border-[rgba(255,255,255,0.1)] text-[#F8FAFC] rounded-lg hover:bg-[rgba(255,255,255,0.02)]">
            <Download className="w-4 h-4 mr-2 inline" />
            Export Data
          </button>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
          <h3 className="text-lg font-semibold text-black mb-4">Income Statement (YTD)</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-black">Revenue</span>
              <span className="font-semibold text-black">$234,567</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-black">Cost of Goods Sold</span>
              <span className="font-semibold text-black">-$67,234</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-black ml-4">Gross Profit</span>
              <span className="font-semibold text-green-400">$167,333</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="font-bold text-black">Net Income</span>
              <span className="font-bold text-lg text-green-400">$88,677</span>
            </div>
          </div>
        </div>

        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
          <h3 className="text-lg font-semibold text-black mb-4">Balance Sheet</h3>
          <div className="space-y-3">
            <div className="border-b pb-3">
              <h4 className="font-medium text-black mb-2">Assets</h4>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-black">Cash</span>
                <span className="text-black">$67,234</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-black">Accounts Receivable</span>
                <span className="text-black">$45,678</span>
              </div>
              <div className="flex justify-between font-semibold text-sm border-t pt-1">
                <span className="text-black">Total Assets</span>
                <span className="text-black">$136,368</span>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-black mb-2">Liabilities & Equity</h4>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-black">Total Liabilities</span>
                <span className="text-black">$35,801</span>
              </div>
              <div className="flex justify-between font-semibold text-sm border-t pt-1">
                <span className="text-black">Owner's Equity</span>
                <span className="text-black">$100,567</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Journal Entries */}
      <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-black">Recent Journal Entries</h3>
          <button className="text-[#818CF8] hover:text-blue-800 text-sm">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase">Entry ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase">Account</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase">Debit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {journalEntries.map((entry, i) => (
                <tr key={i} className="hover:bg-[rgba(255,255,255,0.02)]">
                  <td className="px-4 py-3 text-black">{entry.id}</td>
                  <td className="px-4 py-3 text-black">{entry.date}</td>
                  <td className="px-4 py-3 text-black">{entry.account}</td>
                  <td className="px-4 py-3 text-black">{entry.description}</td>
                  <td className="px-4 py-3 font-semibold text-green-400">{entry.debit}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="text-[#818CF8]"><Eye className="w-4 h-4" /></button>
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
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
          <h3 className="text-lg font-semibold text-black mb-4">Assets</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b"><span className="text-black">Cash</span><span className="font-semibold text-black">$67,234</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-black">Accounts Receivable</span><span className="font-semibold text-black">$45,678</span></div>
            <div className="flex justify-between py-2"><span className="text-black">Equipment</span><span className="font-semibold text-black">$89,234</span></div>
          </div>
        </div>

        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
          <h3 className="text-lg font-semibold text-black mb-4">Liabilities</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b"><span className="text-black">Accounts Payable</span><span className="font-semibold text-black">$23,456</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-black">Short-term Debt</span><span className="font-semibold text-black">$12,345</span></div>
            <div className="flex justify-between py-2"><span className="text-black">Accrued Expenses</span><span className="font-semibold text-black">$8,234</span></div>
          </div>
        </div>

        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
          <h3 className="text-lg font-semibold text-black mb-4">Equity</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b"><span className="text-black">Owner's Equity</span><span className="font-semibold text-black">$100,567</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-black">Retained Earnings</span><span className="font-semibold text-black">$45,234</span></div>
            <div className="flex justify-between py-2"><span className="text-black">Revenue</span><span className="font-semibold text-black">$234,567</span></div>
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
    </div>
  );
};

export default AccountingComponent;
