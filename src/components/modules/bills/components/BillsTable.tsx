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
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Vendor Bills</h3>
        <span className="text-sm text-gray-500">Showing {bills.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bill #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {bills.map((bill, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{bill.id}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{bill.vendor}</td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900">{bill.amount}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{bill.dueDate}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusStyles(bill.status)}`}>
                    {bill.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => onView(bill)}
                      className="text-blue-600 hover:text-blue-800"
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
                      className="text-gray-600 hover:text-gray-800"
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
