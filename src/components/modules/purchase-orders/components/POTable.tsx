'use client';

import React from 'react';
import { Eye, Edit, Download, Trash2 } from 'lucide-react';
import { PurchaseOrder } from '../types';

interface POTableProps {
  purchaseOrders: PurchaseOrder[];
  onView: (po: PurchaseOrder) => void;
  onEdit: (po: PurchaseOrder) => void;
  onDownload: (po: PurchaseOrder) => void;
  onDelete: (po: PurchaseOrder) => void;
}

export const POTable: React.FC<POTableProps> = ({
  purchaseOrders,
  onView,
  onEdit,
  onDownload,
  onDelete
}) => {
  const getStatusStyles = (status: PurchaseOrder['status']) => {
    switch (status) {
      case 'Approved':
        return 'bg-green-100 text-green-800';
      case 'Received':
        return 'bg-blue-100 text-blue-800';
      case 'Closed':
        return 'bg-theme-muted text-theme-text-primary';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-purple-100 text-purple-800';
    }
  };

  return (
    <div className="bg-theme-surface rounded-lg border border-theme-border p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-theme-text-primary">Purchase Orders</h3>
        <span className="text-sm text-theme-text-secondary">Showing {purchaseOrders.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-theme-muted border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">PO #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Vendor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Items</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {purchaseOrders.map((po, i) => (
              <tr key={i} className="hover:bg-theme-muted">
                <td className="px-4 py-3 text-sm font-semibold text-theme-text-primary">{po.poNumber}</td>
                <td className="px-4 py-3 text-sm text-theme-text-primary">{po.vendor}</td>
                <td className="px-4 py-3 text-sm text-theme-text-primary">{po.date}</td>
                <td className="px-4 py-3 text-sm text-theme-text-primary">{po.items}</td>
                <td className="px-4 py-3 text-sm font-semibold text-theme-text-primary">{po.amount}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusStyles(po.status)}`}>
                    {po.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => onView(po)}
                      className="text-theme-accent hover:text-blue-800"
                      title="View PO"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onEdit(po)}
                      className="text-green-600 hover:text-green-800"
                      title="Edit PO"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onDownload(po)}
                      className="text-purple-600 hover:text-purple-800"
                      title="Download PO"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onDelete(po)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete PO"
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
