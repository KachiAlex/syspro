'use client';

import React from 'react';
import { PendingApproval, DepartmentSpend } from '../types';

interface ProcurementAnalyticsProps {
  pendingApprovals?: PendingApproval[];
  departmentSpends?: DepartmentSpend[];
  onApprove?: (approval: PendingApproval) => void;
  onReject?: (approval: PendingApproval) => void;
}

const DEFAULT_PENDING: PendingApproval[] = [
  { id: 'REQ-2024-001', priority: 'High', value: '$12,450', submitted: '2 days ago' },
  { id: 'REQ-2024-003', priority: 'High', value: '$23,450', submitted: '3 days ago' }
];

const DEFAULT_SPENDING: DepartmentSpend[] = [
  { dept: 'IT', spend: '$45,678', pct: 35 },
  { dept: 'Operations', spend: '$32,450', pct: 25 },
  { dept: 'Marketing', spend: '$23,234', pct: 18 },
  { dept: 'HR', spend: '$15,678', pct: 12 }
];

export const ProcurementAnalytics: React.FC<ProcurementAnalyticsProps> = ({
  pendingApprovals = DEFAULT_PENDING,
  departmentSpends = DEFAULT_SPENDING,
  onApprove,
  onReject
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending Approvals</h3>
        <div className="space-y-3">
          {pendingApprovals.map((a, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    a.priority === 'High' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                  }`}>{a.priority}</span>
                  <h4 className="font-medium">{a.id}</h4>
                </div>
                <p className="text-xs text-gray-500">{a.value} • Submitted: {a.submitted}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => onApprove?.(a)}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                >
                  Approve
                </button>
                <button 
                  onClick={() => onReject?.(a)}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Spending by Department</h3>
        <div className="space-y-3">
          {departmentSpends.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-sm font-medium w-24">{d.dept}</span>
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div className="h-2 rounded-full bg-blue-500" style={{ width: `${d.pct}%` }}></div>
              </div>
              <span className="text-sm font-semibold w-20 text-right">{d.spend}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
