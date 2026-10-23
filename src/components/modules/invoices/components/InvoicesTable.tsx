'use client';

import React from 'react';
import { Eye, Send, Download, Trash2 } from 'lucide-react';
import { Invoice } from '../types/invoices';

interface InvoicesTableProps {
  invoices: Invoice[];
  onView: (invoice: Invoice) => void;
  onSend: (invoice: Invoice) => void;
  onDownload: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
}

export const InvoicesTable: React.FC<InvoicesTableProps> = ({
  invoices,
  onView,
  onSend,
  onDownload,
  onDelete
}) => {
  const getStatusStyles = (status: Invoice['status']) => {
    switch (status) {
      case 'Paid':
        return 'bg-green-100 text-green-800';
      case 'Overdue':
        return 'bg-red-100 text-red-800';
      case 'Sent':
        return 'bg-blue-100 text-blue-800';
      case 'Viewed':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-theme-muted text-theme-text-primary';
    }
  };

  return (
    <div className="bg-theme-surface rounded-lg border border-theme-border p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-theme-text-primary">Invoices</h3>
        <span className="text-sm text-theme-text-secondary">Showing {invoices.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-theme-muted border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Invoice #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Issue Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Due Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoices.map((invoice, i) => (
              <tr key={i} className="hover:bg-theme-muted">
                <td className="px-4 py-3 text-sm font-semibold text-theme-text-primary">{invoice.id}</td>
                <td className="px-4 py-3 text-sm text-theme-text-primary">{invoice.customer}</td>
                <td className="px-4 py-3 text-sm font-semibold text-theme-text-primary">{invoice.amount}</td>
                <td className="px-4 py-3 text-sm text-theme-text-primary">{invoice.issueDate}</td>
                <td className="px-4 py-3 text-sm text-theme-text-primary">{invoice.dueDate}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusStyles(invoice.status)}`}>
                    {invoice.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => onView(invoice)}
                      className="text-theme-accent hover:text-blue-800"
                      title="View invoice"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onSend(invoice)}
                      className="text-green-600 hover:text-green-800"
                      title="Send invoice"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onDownload(invoice)}
                      className="text-purple-600 hover:text-purple-800"
                      title="Download invoice"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onDelete(invoice)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete invoice"
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
    </div>
  );
};
