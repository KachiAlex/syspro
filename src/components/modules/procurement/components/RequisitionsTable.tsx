'use client';

import React from 'react';
import { Eye, Edit, Package } from 'lucide-react';
import { Requisition } from '../types';

interface RequisitionsTableProps {
  requisitions: Requisition[];
  onView: (req: Requisition) => void;
  onEdit: (req: Requisition) => void;
  onCreatePO: (req: Requisition) => void;
}

export const RequisitionsTable: React.FC<RequisitionsTableProps> = ({
  requisitions,
  onView,
  onEdit,
  onCreatePO
}) => {
  const getStatusStyles = (status: Requisition['status']) => {
    switch (status) {
      case 'Approved':
        return 'bg-green-100 text-green-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      case 'Ordered':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="bg-theme-surface rounded-lg border border-theme-border p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-theme-text-primary">Purchase Requisitions</h3>
        <button className="text-theme-accent hover:text-blue-800 text-sm">View All</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-theme-muted border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Requisition ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Requester</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Department</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Items</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Value</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {requisitions.map((req, i) => (
              <tr key={i} className="hover:bg-theme-muted">
                <td className="px-4 py-3">{req.id}</td>
                <td className="px-4 py-3">{req.requester}</td>
                <td className="px-4 py-3">{req.department}</td>
                <td className="px-4 py-3">{req.items}</td>
                <td className="px-4 py-3 font-semibold">{req.value}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusStyles(req.status)}`}>
                    {req.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => onView(req)}
                      className="text-theme-accent hover:text-blue-800"
                      title="View requisition"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onEdit(req)}
                      className="text-green-600 hover:text-green-800"
                      title="Edit requisition"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onCreatePO(req)}
                      className="text-purple-600 hover:text-purple-800"
                      title="Create PO"
                    >
                      <Package className="w-4 h-4" />
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
