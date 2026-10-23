'use client';

import React from 'react';

interface IncomeStatementProps {
  revenue?: string;
  cogs?: string;
  grossProfit?: string;
  netIncome?: string;
}

export const IncomeStatement: React.FC<IncomeStatementProps> = ({
  revenue = '$234,567',
  cogs = '-$67,234',
  grossProfit = '$167,333',
  netIncome = '$88,677'
}) => {
  return (
    <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
      <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Income Statement (YTD)</h3>
      <div className="space-y-3">
        <div className="flex justify-between items-center py-2 border-b">
          <span className="text-theme-text-secondary">Revenue</span>
          <span className="font-semibold">{revenue}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b">
          <span className="text-theme-text-secondary">Cost of Goods Sold</span>
          <span className="font-semibold">{cogs}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b">
          <span className="text-theme-text-secondary ml-4">Gross Profit</span>
          <span className="font-semibold text-green-600">{grossProfit}</span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="font-bold">Net Income</span>
          <span className="font-bold text-lg text-green-600">{netIncome}</span>
        </div>
      </div>
    </div>
  );
};
