'use client';

import React from 'react';
import { FileText, AlertCircle, DollarSign, Package } from 'lucide-react';

interface POHeaderProps {
  totalPOs: number;
  pendingPOs?: number;
  totalValue?: string;
  onOrder?: string;
}

export const POHeader: React.FC<POHeaderProps> = ({
  totalPOs,
  pendingPOs = 12,
  totalValue = '$234,567',
  onOrder = '$89,234'
}) => {
  const stats = [
    { label: 'Total POs', value: totalPOs, icon: FileText, color: 'text-blue-600' },
    { label: 'Pending POs', value: pendingPOs, icon: AlertCircle, color: 'text-orange-600' },
    { label: 'Total Value', value: totalValue, icon: DollarSign, color: 'text-green-600' },
    { label: 'On Order', value: onOrder, icon: Package, color: 'text-purple-600' }
  ];

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Purchase Orders</h2>
        <p className="text-gray-600">Create and manage purchase orders, track deliveries, and manage vendor communications</p>
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
