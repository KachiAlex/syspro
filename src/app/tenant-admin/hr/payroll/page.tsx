'use client';

import React from 'react';
import { DollarSign, TrendingUp, Users } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

export default function PayrollPage() {
  const { tenantSlug } = useTenantContext();

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Payroll Management</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600 mb-2">Monthly Payroll</p>
          <p className="text-3xl font-bold text-gray-900">$125,450</p>
          <p className="text-xs text-gray-500 mt-2">Current period</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600 mb-2">Annual Payroll</p>
          <p className="text-3xl font-bold text-gray-900">$1.5M</p>
          <p className="text-xs text-gray-500 mt-2">Projected</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600 mb-2">Average Salary</p>
          <p className="text-3xl font-bold text-gray-900">$65,230</p>
          <p className="text-xs text-gray-500 mt-2">Per employee</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600 mb-2">Total Benefits</p>
          <p className="text-3xl font-bold text-gray-900">$43,908</p>
          <p className="text-xs text-gray-500 mt-2">Monthly allocation</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payroll Breakdown</h3>
        <div className="space-y-3">
          {[
            { label: 'Base Salary', amount: '$125,450', percentage: 65 },
            { label: 'Allowances', amount: '$35,200', percentage: 18 },
            { label: 'Bonuses', amount: '$21,340', percentage: 11 },
            { label: 'Other', amount: '$6,010', percentage: 6 },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">{item.label}</span>
                  <span className="text-sm font-semibold text-gray-900">{item.amount}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${item.percentage}%` }} />
                </div>
              </div>
              <span className="ml-4 text-sm text-gray-600 w-12 text-right">{item.percentage}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Period</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Employees</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Total Amount</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Processed Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {[
              { period: 'April 2026', employees: 5, amount: '$125,450', status: 'Paid', date: '2026-04-05' },
              { period: 'March 2026', employees: 5, amount: '$125,450', status: 'Paid', date: '2026-03-05' },
              { period: 'February 2026', employees: 5, amount: '$123,210', status: 'Paid', date: '2026-02-05' },
            ].map((run, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{run.period}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{run.employees}</td>
                <td className="px-6 py-4 text-sm font-semibold text-gray-900">{run.amount}</td>
                <td className="px-6 py-4 text-sm">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {run.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{run.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Deductions & Taxes</h4>
          <div className="space-y-3">
            {[
              { name: 'Income Tax', amount: '$18,450', percentage: 14.7 },
              { name: 'Social Security', amount: '$7,765', percentage: 6.2 },
              { name: 'Medicare', amount: '$1,818', percentage: 1.45 },
              { name: 'Health Insurance', amount: '$5,200', percentage: 4.1 },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-600">{item.percentage}% of payroll</p>
                </div>
                <span className="font-semibold text-gray-900">{item.amount}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Benefits Administration</h4>
          <div className="space-y-3">
            {[
              { name: 'Health Insurance', enrolled: 5, cost: '$8,500' },
              { name: '401(k) Plan', enrolled: 4, cost: '$3,200' },
              { name: 'Life Insurance', enrolled: 5, cost: '$1,250' },
              { name: 'Dental Plan', enrolled: 3, cost: '$900' },
            ].map((benefit, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{benefit.name}</p>
                  <p className="text-xs text-gray-600">{benefit.enrolled} employees</p>
                </div>
                <span className="font-semibold text-gray-900">{benefit.cost}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
