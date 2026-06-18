'use client';

import React from 'react';
import { Building, FileText, Star, TrendingUp } from 'lucide-react';

interface VendorsHeaderProps {
  totalVendors: number;
  activeContracts?: number;
  avgPerformance?: string;
  monthlySpend?: string;
}

export const VendorsHeader: React.FC<VendorsHeaderProps> = ({
  totalVendors,
  activeContracts = 89,
  avgPerformance = '4.2/5',
  monthlySpend = '$45,678'
}) => {
  const stats = [
    { label: 'Total Vendors', value: totalVendors, icon: Building, color: 'text-blue-600' },
    { label: 'Active Contracts', value: activeContracts, icon: FileText, color: 'text-green-600' },
    { label: 'Avg. Performance', value: avgPerformance, icon: Star, color: 'text-yellow-600' },
    { label: 'This Month Spend', value: monthlySpend, icon: TrendingUp, color: 'text-purple-600' }
  ];

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Vendor Management</h2>
        <p className="text-gray-600">Manage vendor profiles, contracts, and performance tracking</p>
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
