'use client';

import React from 'react';
import { TrendingUp, Calculator, Database, Download } from 'lucide-react';

interface FinancialMetricsProps {
  totalRevenue?: string;
  totalExpenses?: string;
  netIncome?: string;
  cashBalance?: string;
}

export const FinancialMetrics: React.FC<FinancialMetricsProps> = ({
  totalRevenue = '$234,567',
  totalExpenses = '$145,890',
  netIncome = '$88,677',
  cashBalance = '$67,234'
}) => {
  const metrics = [
    { label: 'Total Revenue', value: totalRevenue, icon: TrendingUp, color: 'text-green-600' },
    { label: 'Total Expenses', value: totalExpenses, icon: Calculator, color: 'text-red-600' },
    { label: 'Net Income', value: netIncome, icon: TrendingUp, color: 'text-blue-600' },
    { label: 'Cash Balance', value: cashBalance, icon: Database, color: 'text-purple-600' }
  ];

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Accounting Workspace</h2>
        <p className="text-gray-600">Manage journal entries, financial reports, and chart of accounts</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{metric.label}</p>
                  <p className="text-xl font-bold text-gray-900">{metric.value}</p>
                </div>
                <Icon className={`w-8 h-8 ${metric.color}`} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
