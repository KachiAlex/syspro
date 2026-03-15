'use client';

import React from 'react';

interface DepartmentData {
  dept: string;
  count: number;
  pct: number;
}

interface PayrollData {
  label: string;
  amount: string;
  bgColor: string;
  textColor: string;
}

interface HRAnalyticsProps {
  departmentData?: DepartmentData[];
  payrollData?: PayrollData[];
}

const DEFAULT_DEPARTMENTS: DepartmentData[] = [
  { dept: 'Engineering', count: 45, pct: 19 },
  { dept: 'Sales', count: 38, pct: 16 },
  { dept: 'Marketing', count: 28, pct: 12 },
  { dept: 'Finance', count: 22, pct: 9 },
  { dept: 'Operations', count: 86, pct: 38 }
];

const DEFAULT_PAYROLL: PayrollData[] = [
  { label: 'Monthly', amount: '$456,789', bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
  { label: 'Annual', amount: '$5.4M', bgColor: 'bg-green-50', textColor: 'text-green-600' },
  { label: 'Avg Salary', amount: '$1,952', bgColor: 'bg-purple-50', textColor: 'text-purple-600' },
  { label: 'Benefits', amount: '$234,567', bgColor: 'bg-orange-50', textColor: 'text-orange-600' }
];

export const HRAnalytics: React.FC<HRAnalyticsProps> = ({
  departmentData = DEFAULT_DEPARTMENTS,
  payrollData = DEFAULT_PAYROLL
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Distribution</h3>
        <div className="space-y-3">
          {departmentData.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-900 w-24">{d.dept}</span>
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div className="h-2 rounded-full bg-blue-500" style={{ width: `${d.pct}%` }}></div>
              </div>
              <span className="text-sm text-gray-600 w-8 text-right">{d.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payroll Summary</h3>
        <div className="grid grid-cols-2 gap-4">
          {payrollData.map((p, i) => (
            <div key={i} className={`text-center p-4 ${p.bgColor} rounded-lg`}>
              <p className={`text-2xl font-bold ${p.textColor}`}>{p.amount}</p>
              <p className="text-sm text-gray-600">{p.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
