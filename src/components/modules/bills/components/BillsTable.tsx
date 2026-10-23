'use client';

import React from 'react';
import { Eye, Edit, CreditCard, Download } from 'lucide-react';
import { Bill } from '../types';

interface BillsTableProps {
  bills: Bill[];
  onView: (bill: Bill) => void;
  onEdit: (bill: Bill) => void;
  onPayment: (bill: Bill) => void;
  onDownload: (bill: Bill) => void;
}

export const BillsTable: React.FC<BillsTableProps> = ({
  bills,
  onView,
  onEdit,
  onPayment,
  onDownload
}) => {
  const getStatusStyles = (status: Bill['status']) => {
    switch (status) {
      case 'Paid':
        return 'bg-green-100 text-green-800';
      case 'Overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="bg-theme-surface rounded-lg border border-theme-border p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-theme-text-primary">Vendor Bills</h3>
        <span className="text-sm text-theme-text-secondary">Showing {bills.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-theme-muted border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Bill #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Vendor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Due Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {bills.map((bill, i) => (
              <tr key={i} className="hover:bg-theme-muted">
                <td className="px-4 py-3 text-sm text-theme-text-primary">{bill.id}</td>
                <td className="px-4 py-3 text-sm text-theme-text-primary">{bill.vendor}</td>
                <td className="px-4 py-3 text-sm font-semibold text-theme-text-primary">{bill.amount}</td>
                <td className="px-4 py-3 text-sm text-theme-text-primary">{bill.dueDate}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusStyles(bill.status)}`}>
                    {bill.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => onView(bill)}
                      className="text-theme-accent hover:text-blue-800"
                      title="View bill"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onEdit(bill)}
                      className="text-green-600 hover:text-green-800"
                      title="Edit bill"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onPayment(bill)}
                      className="text-purple-600 hover:text-purple-800"
                      title="Make payment"
                    >
                      <CreditCard className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onDownload(bill)}
                      className="text-theme-text-secondary hover:text-theme-text-primary"
                      title="Download bill"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
