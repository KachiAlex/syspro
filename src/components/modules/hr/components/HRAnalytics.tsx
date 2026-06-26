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

export const HRAnalytics: React.FC<HRAnalyticsProps> = ({
  departmentData = [],
  payrollData = [],
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
