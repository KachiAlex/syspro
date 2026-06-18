'use client';

import React from 'react';
import { Users, Target, DollarSign, Award } from 'lucide-react';

interface HRStatisticsProps {
  totalEmployees: number;
  openPositions?: number;
  monthlyPayroll?: string;
  avgPerformance?: string;
}

export const HRStatistics: React.FC<HRStatisticsProps> = ({
  totalEmployees,
  openPositions = 12,
  monthlyPayroll = '$456,789',
  avgPerformance = '4.2/5'
}) => {
  const stats = [
    {
      label: 'Total Employees',
      value: totalEmployees,
      icon: Users,
      color: 'text-blue-600'
    },
    {
      label: 'Open Positions',
      value: openPositions,
      icon: Target,
      color: 'text-orange-600'
    },
    {
      label: 'Monthly Payroll',
      value: monthlyPayroll,
      icon: DollarSign,
      color: 'text-green-600'
    },
    {
      label: 'Avg. Performance',
      value: avgPerformance,
      icon: Award,
      color: 'text-purple-600'
    }
  ];

  return (
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
  );
};
