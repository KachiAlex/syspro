import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BalanceSheet } from '@/lib/finance/assets-reports';

interface BalanceSheetComponentProps {
  report: BalanceSheet | null;
  isLoading: boolean;
  onDrillDown?: (accountId: string) => void;
  onExport?: (format: 'csv' | 'pdf') => void;
}

export function BalanceSheetComponent({
  report,
  isLoading,
  onDrillDown,
  onExport,
}: BalanceSheetComponentProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-theme-text-secondary">Loading Balance Sheet...</p>
        </div>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card className="p-6">
        <p className="text-theme-text-secondary">No report data available</p>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const isBalanced = Math.abs(
    report.totalAssets - (report.totalLiabilities + report.totalEquity)
  ) < 0.01;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Balance Sheet</h2>
          <p className="text-sm text-theme-text-secondary">
            As of {report.asOfDate.toLocaleDateString()}
          </p>
        </div>
        <div className="space-x-2">
          <button
            onClick={() => onExport?.('csv')}
            className="px-4 py-2 bg-theme-muted hover:bg-theme-elevated rounded text-sm font-medium"
          >
            Export CSV
          </button>
          <button
            onClick={() => onExport?.('pdf')}
            className="px-4 py-2 bg-blue-500 hover:bg-theme-accent-hover text-white rounded text-sm font-medium"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Accounting Equation Status */}
      <Card className="p-4 bg-blue-50 border border-blue-200">
        <div className="flex justify-between items-center">
          <div>
            <p className="font-semibold">Accounting Equation: Assets = Liabilities + Equity</p>
            <p className="text-sm text-theme-text-secondary">
              {formatCurrency(report.totalAssets)} = {formatCurrency(report.totalLiabilities)} +
              {formatCurrency(report.totalEquity)}
            </p>
          </div>
          <Badge variant={isBalanced ? 'default' : 'destructive'}>
            {isBalanced ? 'Balanced' : 'Unbalanced'}
          </Badge>
        </div>
      </Card>

      {/* Assets Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Assets</h3>
        <div className="space-y-2 mb-4">
          {report.assets.map((line) => (
            <div
              key={line.code}
              className="flex justify-between items-center py-2 border-b hover:bg-theme-muted cursor-pointer"
              onClick={() => onDrillDown?.(line.code)}
            >
              <div>
                <p className="font-medium">{line.name}</p>
                <p className="text-sm text-theme-text-secondary">
                  {line.code} • {line.accountType}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatCurrency(line.balance)}</p>
                <p className="text-sm text-theme-text-secondary">
                  {formatPercent(line.percentOfTotal || 0)}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center pt-4 border-t-2 border-theme-border font-bold text-lg">
          <span>Total Assets</span>
          <span>{formatCurrency(report.totalAssets)}</span>
        </div>
      </Card>

      {/* Liabilities Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Liabilities</h3>
        <div className="space-y-2 mb-4">
          {report.liabilities.map((line) => (
            <div
              key={line.code}
              className="flex justify-between items-center py-2 border-b hover:bg-theme-muted cursor-pointer"
              onClick={() => onDrillDown?.(line.code)}
            >
              <div>
                <p className="font-medium">{line.name}</p>
                <p className="text-sm text-theme-text-secondary">
                  {line.code} • {line.accountType}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatCurrency(line.balance)}</p>
                <p className="text-sm text-theme-text-secondary">
                  {formatPercent(line.percentOfTotal || 0)}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center pt-4 border-t-2 border-theme-border font-bold text-lg">
          <span>Total Liabilities</span>
          <span>{formatCurrency(report.totalLiabilities)}</span>
        </div>
      </Card>

      {/* Equity Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Equity</h3>
        <div className="space-y-2 mb-4">
          {report.equity.map((line) => (
            <div
              key={line.code}
              className="flex justify-between items-center py-2 border-b hover:bg-theme-muted cursor-pointer"
              onClick={() => onDrillDown?.(line.code)}
            >
              <div>
                <p className="font-medium">{line.name}</p>
                <p className="text-sm text-theme-text-secondary">
                  {line.code} • {line.accountType}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatCurrency(line.balance)}</p>
                <p className="text-sm text-theme-text-secondary">
                  {formatPercent(line.percentOfTotal || 0)}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center pt-4 border-t-2 border-theme-border font-bold text-lg">
          <span>Total Equity</span>
          <span>{formatCurrency(report.totalEquity)}</span>
        </div>
      </Card>

      {/* Financial Ratios */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-6">
          <p className="text-sm text-theme-text-secondary mb-2">Current Ratio</p>
          <p className="text-2xl font-bold">
            {report.totalAssets > 0 ? (report.totalAssets / (report.totalLiabilities || 1)).toFixed(2) : '0.00'}
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-theme-text-secondary mb-2">Debt-to-Equity</p>
          <p className="text-2xl font-bold">
            {report.totalEquity > 0 ? (report.totalLiabilities / report.totalEquity).toFixed(2) : '0.00'}
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-theme-text-secondary mb-2">Equity Ratio</p>
          <p className="text-2xl font-bold">
            {formatPercent(
              report.totalAssets > 0
                ? (report.totalEquity / report.totalAssets) * 100
                : 0
            )}
          </p>
        </Card>
      </div>
    </div>
  );
}
