'use client';

import React from 'react';
import { Package, Target, TrendingUp, Building } from 'lucide-react';

interface ProcurementHeaderProps {
  totalRequisitions: number;
  pendingApproval?: number;
  monthlySpend?: string;
  activeVendors?: number;
}

export const ProcurementHeader: React.FC<ProcurementHeaderProps> = ({
  totalRequisitions,
  pendingApproval = 45,
  monthlySpend = '$89,234',
  activeVendors = 167
}) => {
  const stats = [
    { label: 'Total Requisitions', value: totalRequisitions, icon: Package, color: 'text-blue-600' },
    { label: 'Pending Approval', value: pendingApproval, icon: Target, color: 'text-orange-600' },
    { label: 'This Month Spend', value: monthlySpend, icon: TrendingUp, color: 'text-green-600' },
    { label: 'Active Vendors', value: activeVendors, icon: Building, color: 'text-purple-600' }
  ];

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Procurement Workspace</h2>
        <p className="text-gray-600">Manage purchase requisitions, vendor selection, and procurement workflows</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{stat.label}</p>
                  <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <Icon className={`w-8 h-8 ${stat.color}`} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
