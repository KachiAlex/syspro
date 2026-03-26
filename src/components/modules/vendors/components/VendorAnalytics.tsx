'use client';

import React from 'react';
import { VendorPerformance, VendorSpend } from '../types';

interface VendorAnalyticsProps {
  performanceData?: VendorPerformance[];
  spendData?: VendorSpend[];
}

const DEFAULT_PERFORMANCE: VendorPerformance[] = [
  { level: 'Excellent', count: 45, pct: 27, color: 'bg-green-500' },
  { level: 'Good', count: 67, pct: 40, color: 'bg-blue-500' },
  { level: 'Average', count: 34, pct: 20, color: 'bg-yellow-500' },
  { level: 'Poor', count: 21, pct: 13, color: 'bg-red-500' }
];

const DEFAULT_SPEND: VendorSpend[] = [
  { name: 'Manufacturing Partners Inc', spend: '$234,567', pct: 35 },
  { name: 'Tech Solutions Inc', spend: '$125,000', pct: 19 },
  { name: 'Global Logistics Ltd', spend: '$89,234', pct: 13 }
];

export const VendorAnalytics: React.FC<VendorAnalyticsProps> = ({
  performanceData = DEFAULT_PERFORMANCE,
  spendData = DEFAULT_SPEND
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Distribution</h3>
        <div className="space-y-3">
          {performanceData.map((p, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-sm font-medium w-20">{p.level}</span>
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div className={`h-2 rounded-full ${p.color}`} style={{ width: `${p.pct}%` }}></div>
              </div>
              <span className="text-sm w-8 text-right">{p.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Vendors by Spend</h3>
        <div className="space-y-3">
          {spendData.map((v, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium text-gray-900 text-sm">{v.name}</p>
                <div className="flex-1 bg-gray-200 rounded-full h-2 mt-1">
                  <div className="h-2 rounded-full bg-blue-500" style={{ width: `${v.pct}%` }}></div>
                </div>
              </div>
              <span className="font-semibold ml-3 text-sm">{v.spend}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
