'use client';

import React, { useState } from 'react';
import { Plus, Download, FileText, Database, TrendingUp, Calculator, Eye, Edit } from 'lucide-react';

interface Accounting {
  tenantSlug: string;
}

const AccountingComponent: React.FC<Accounting> = ({ tenantSlug }) => {
  const [journalEntries] = useState([
    { id: 'JE-2024-001', date: '2024-02-22', account: 'Cash', description: 'Payment from Tech Corp', debit: '$15,000', credit: '' },
    { id: 'JE-2024-002', date: '2024-02-21', account: 'Office Supplies', description: 'Equipment purchase', debit: '$234.75', credit: '' }
  ]);

  const [alert, setAlert] = useState<{ type: 'success' | 'info'; message: string } | null>(null);

  const handleGenerateReport = (type: string) => {
    setAlert({ type: 'success', message: `${type} report generated successfully!` });
  };

  const handleExportData = () => {
    setAlert({ type: 'success', message: 'Financial data exported successfully!' });
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Accounting Workspace</h2>
        <p className="text-gray-600">Manage journal entries, financial reports, and chart of accounts</p>
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-xl font-bold text-gray-900">$234,567</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Expenses</p>
              <p className="text-xl font-bold text-gray-900">$145,890</p>
            </div>
            <Calculator className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Net Income</p>
              <p className="text-xl font-bold text-gray-900">$88,677</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Cash Balance</p>
              <p className="text-xl font-bold text-gray-900">$67,234</p>
            </div>
            <Database className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2 inline" />
            Journal Entry
          </button>
          <button onClick={() => handleGenerateReport('Income Statement')} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            <FileText className="w-4 h-4 mr-2 inline" />
            Generate Report
          </button>
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            <Database className="w-4 h-4 mr-2 inline" />
            Chart of Accounts
          </button>
          <button onClick={handleExportData} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4 mr-2 inline" />
            Export Data
          </button>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Income Statement (YTD)</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600">Revenue</span>
              <span className="font-semibold">$234,567</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600">Cost of Goods Sold</span>
              <span className="font-semibold">-$67,234</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600 ml-4">Gross Profit</span>
              <span className="font-semibold text-green-600">$167,333</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="font-bold">Net Income</span>
              <span className="font-bold text-lg text-green-600">$88,677</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Balance Sheet</h3>
          <div className="space-y-3">
            <div className="border-b pb-3">
              <h4 className="font-medium text-gray-900 mb-2">Assets</h4>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Cash</span>
                <span>$67,234</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Accounts Receivable</span>
                <span>$45,678</span>
              </div>
              <div className="flex justify-between font-semibold text-sm border-t pt-1">
                <span>Total Assets</span>
                <span>$136,368</span>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Liabilities & Equity</h4>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Total Liabilities</span>
                <span>$35,801</span>
              </div>
              <div className="flex justify-between font-semibold text-sm border-t pt-1">
                <span>Owner's Equity</span>
                <span>$100,567</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Journal Entries */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Journal Entries</h3>
          <button className="text-blue-600 hover:text-blue-800 text-sm">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entry ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Debit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {journalEntries.map((entry, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{entry.id}</td>
                  <td className="px-4 py-3">{entry.date}</td>
                  <td className="px-4 py-3">{entry.account}</td>
                  <td className="px-4 py-3">{entry.description}</td>
                  <td className="px-4 py-3 font-semibold text-green-600">{entry.debit}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="text-blue-600"><Eye className="w-4 h-4" /></button>
                      <button className="text-green-600"><Edit className="w-4 h-4" /></button>
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
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Assets</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b"><span>Cash</span><span className="font-semibold">$67,234</span></div>
            <div className="flex justify-between py-2 border-b"><span>Accounts Receivable</span><span className="font-semibold">$45,678</span></div>
            <div className="flex justify-between py-2"><span>Equipment</span><span className="font-semibold">$89,234</span></div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Liabilities</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b"><span>Accounts Payable</span><span className="font-semibold">$23,456</span></div>
            <div className="flex justify-between py-2 border-b"><span>Short-term Debt</span><span className="font-semibold">$12,345</span></div>
            <div className="flex justify-between py-2"><span>Accrued Expenses</span><span className="font-semibold">$8,234</span></div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Equity</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b"><span>Owner's Equity</span><span className="font-semibold">$100,567</span></div>
            <div className="flex justify-between py-2 border-b"><span>Retained Earnings</span><span className="font-semibold">$45,234</span></div>
            <div className="flex justify-between py-2"><span>Revenue</span><span className="font-semibold">$234,567</span></div>
          </div>
        </div>
      </div>

      {alert && (
        <div className="fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white font-medium bg-green-600">
          {alert.message}
        </div>
      )}
    </div>
  );
};

export default AccountingComponent;
