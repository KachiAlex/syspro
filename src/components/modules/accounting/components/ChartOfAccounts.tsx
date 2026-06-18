'use client';

import React from 'react';

interface ChartOfAccountsProps {
  assets?: { label: string; amount: string }[];
  liabilities?: { label: string; amount: string }[];
  equity?: { label: string; amount: string }[];
}

const DEFAULT_ASSETS = [
  { label: 'Cash', amount: '$67,234' },
  { label: 'Accounts Receivable', amount: '$45,678' },
  { label: 'Equipment', amount: '$89,234' }
];

const DEFAULT_LIABILITIES = [
  { label: 'Accounts Payable', amount: '$23,456' },
  { label: 'Short-term Debt', amount: '$12,345' },
  { label: 'Accrued Expenses', amount: '$8,234' }
];

const DEFAULT_EQUITY = [
  { label: 'Retained Earnings', amount: '$100,567' },
  { label: 'Capital Stock', amount: '$50,000' }
];

export const ChartOfAccounts: React.FC<ChartOfAccountsProps> = ({
  assets = DEFAULT_ASSETS,
  liabilities = DEFAULT_LIABILITIES,
  equity = DEFAULT_EQUITY
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Assets</h3>
        <div className="space-y-2 text-sm">
          {assets.map((item, i) => (
            <div key={i} className="flex justify-between py-2 border-b">
              <span>{item.label}</span>
              <span className="font-semibold">{item.amount}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Liabilities</h3>
        <div className="space-y-2 text-sm">
          {liabilities.map((item, i) => (
            <div key={i} className="flex justify-between py-2 border-b">
              <span>{item.label}</span>
              <span className="font-semibold">{item.amount}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Equity</h3>
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
