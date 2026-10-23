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
    { label: 'Total Requisitions', value: totalRequisitions, icon: Package, color: 'text-theme-accent' },
    { label: 'Pending Approval', value: pendingApproval, icon: Target, color: 'text-orange-600' },
    { label: 'This Month Spend', value: monthlySpend, icon: TrendingUp, color: 'text-green-600' },
    { label: 'Active Vendors', value: activeVendors, icon: Building, color: 'text-purple-600' }
  ];

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-theme-text-primary mb-2">Procurement Workspace</h2>
        <p className="text-theme-text-secondary">Manage purchase requisitions, vendor selection, and procurement workflows</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-theme-surface rounded-lg border border-theme-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-theme-text-secondary">{stat.label}</p>
                  <p className="text-xl font-bold text-theme-text-primary">{stat.value}</p>
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
