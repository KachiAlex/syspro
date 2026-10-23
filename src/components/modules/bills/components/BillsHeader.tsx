'use client';

import React from 'react';
import { FileText, Calculator, AlertCircle, Calendar } from 'lucide-react';

interface BillsHeaderProps {
  totalBills: number;
  totalOutstanding: string;
  totalOverdue: string;
  dueThisWeek: string;
}

export const BillsHeader: React.FC<BillsHeaderProps> = ({
  totalBills,
  totalOutstanding,
  totalOverdue,
  dueThisWeek
}) => {
  const stats = [
    { label: 'Total Bills', value: totalBills, icon: FileText, color: 'text-theme-accent' },
    { label: 'Outstanding', value: totalOutstanding, icon: Calculator, color: 'text-orange-600' },
    { label: 'Overdue', value: totalOverdue, icon: AlertCircle, color: 'text-red-600' },
    { label: 'Due This Week', value: dueThisWeek, icon: Calendar, color: 'text-purple-600' }
  ];

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-theme-text-primary mb-2">Bills & Payables Management</h2>
        <p className="text-theme-text-secondary">Process vendor bills, schedule payments, and track accounts payable</p>
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
