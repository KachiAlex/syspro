'use client';

import React from 'react';

interface ChartOfAccountsProps {
  assets?: { label: string; amount: string }[];
  liabilities?: { label: string; amount: string }[];
  equity?: { label: string; amount: string }[];
}

export const ChartOfAccounts: React.FC<ChartOfAccountsProps> = ({
  assets = [],
  liabilities = [],
  equity = []
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
        <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Assets</h3>
        <div className="space-y-2 text-sm">
          {assets.map((item, i) => (
            <div key={i} className="flex justify-between py-2 border-b">
              <span>{item.label}</span>
              <span className="font-semibold">{item.amount}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
        <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Liabilities</h3>
        <div className="space-y-2 text-sm">
          {liabilities.map((item, i) => (
            <div key={i} className="flex justify-between py-2 border-b">
              <span>{item.label}</span>
              <span className="font-semibold">{item.amount}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
        <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Equity</h3>
        <div className="space-y-2 text-sm">
          {equity.map((item, i) => (
            <div key={i} className="flex justify-between py-2 border-b">
              <span>{item.label}</span>
              <span className="font-semibold">{item.amount}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
