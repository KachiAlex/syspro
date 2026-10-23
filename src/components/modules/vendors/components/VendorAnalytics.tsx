'use client';

import React from 'react';
import { VendorPerformance, VendorSpend } from '../types';

interface VendorAnalyticsProps {
  performanceData?: VendorPerformance[];
  spendData?: VendorSpend[];
}

export const VendorAnalytics: React.FC<VendorAnalyticsProps> = ({
  performanceData = [],
  spendData = []
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
        <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Performance Distribution</h3>
        <div className="space-y-3">
          {performanceData.map((p, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-sm font-medium w-20">{p.level}</span>
              <div className="flex-1 bg-theme-muted rounded-full h-2">
                <div className={`h-2 rounded-full ${p.color}`} style={{ width: `${p.pct}%` }}></div>
              </div>
              <span className="text-sm w-8 text-right">{p.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
        <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Top Vendors by Spend</h3>
        <div className="space-y-3">
          {spendData.map((v, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium text-theme-text-primary text-sm">{v.name}</p>
                <div className="flex-1 bg-theme-muted rounded-full h-2 mt-1">
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
