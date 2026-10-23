import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PnLReport } from '@/lib/finance/assets-reports';

interface PnLReportProps {
  report: PnLReport | null;
  isLoading: boolean;
  onDrillDown?: (accountId: string) => void;
  onExport?: (format: 'csv' | 'pdf') => void;
}

export function PnLReportComponent({
  report,
  isLoading,
  onDrillDown,
  onExport,
}: PnLReportProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-theme-text-secondary">Loading P&L Report...</p>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Profit & Loss Statement</h2>
          <p className="text-sm text-theme-text-secondary">
            {report.periodStart.toLocaleDateString()} -{' '}
            {report.periodEnd.toLocaleDateString()}
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

      {/* Revenue Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Revenue</h3>
        <div className="space-y-2 mb-4">
          {report.revenue.map((line) => (
            <div
              key={line.code}
              className="flex justify-between items-center py-2 border-b hover:bg-theme-muted cursor-pointer"
              onClick={() => onDrillDown?.(line.code)}
            >
              <div>
                <p className="font-medium">{line.name}</p>
                <p className="text-sm text-theme-text-secondary">{line.code}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatCurrency(line.amountTotal)}</p>
                <p className="text-sm text-theme-text-secondary">
                  {formatPercent(line.percentOfRevenue || 0)}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center pt-4 border-t-2 border-theme-border font-bold text-lg">
          <span>Total Revenue</span>
          <span>{formatCurrency(report.totalRevenue)}</span>
        </div>
      </Card>

      {/* Expenses Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Expenses</h3>
        <div className="space-y-2 mb-4">
          {report.expenses.map((line) => (
            <div
              key={line.code}
              className="flex justify-between items-center py-2 border-b hover:bg-theme-muted cursor-pointer"
              onClick={() => onDrillDown?.(line.code)}
            >
              <div>
                <p className="font-medium">{line.name}</p>
                <p className="text-sm text-theme-text-secondary">{line.code}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatCurrency(line.amountTotal)}</p>
                <p className="text-sm text-theme-text-secondary">
                  {formatPercent(line.percentOfRevenue || 0)}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center pt-4 border-t-2 border-theme-border font-bold text-lg">
          <span>Total Expenses</span>
          <span>{formatCurrency(report.totalExpenses)}</span>
        </div>
      </Card>

      {/* Summary Section */}
      <Card className="p-6 bg-blue-50">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-lg font-semibold">Net Income</p>
            <p className="text-sm text-theme-text-secondary">
              {report.netIncome >= 0 ? 'Profitable' : 'Loss'}
            </p>
          </div>
          <div className="text-right">
            <Badge
              variant={report.netIncome >= 0 ? 'default' : 'destructive'}
              className="text-lg px-4 py-2"
            >
              {formatCurrency(report.netIncome)}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-6">
          <p className="text-sm text-theme-text-secondary mb-2">Profit Margin</p>
          <p className="text-2xl font-bold">
            {report.totalRevenue > 0
              ? formatPercent((report.netIncome / report.totalRevenue) * 100)
              : '0%'}
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-theme-text-secondary mb-2">Expense Ratio</p>
          <p className="text-2xl font-bold">
            {report.totalRevenue > 0
              ? formatPercent((report.totalExpenses / report.totalRevenue) * 100)
              : '0%'}
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-theme-text-secondary mb-2">ROI</p>
          <p className="text-2xl font-bold">
            {formatPercent(
              report.totalRevenue > 0
                ? ((report.netIncome / report.totalRevenue) * 100)
                : 0
            )}
          </p>
        </Card>
      </div>
    </div>
  );
}
