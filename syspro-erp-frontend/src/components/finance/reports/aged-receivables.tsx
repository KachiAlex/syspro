import React from 'react';
import { Card } from '@/components/ui/card';
import { AgedReceivablesReport } from '@/lib/finance/assets-reports';

interface AgedReceivablesProps {
  report: AgedReceivablesReport | null;
  isLoading: boolean;
  onExport?: (format: 'csv' | 'pdf') => void;
}

export function AgedReceivablesComponent({
  report,
  isLoading,
  onExport,
}: AgedReceivablesProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Loading Aged Receivables Report...</p>
        </div>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card className="p-6">
        <p className="text-gray-500">No report data available</p>
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
    return `${(value * 100).toFixed(2)}%`;
  };

  const agingBuckets = [
    { label: 'Current (0-30 days)', value: report.currentAmount },
    { label: '31-60 days', value: report.days31to60 },
    { label: '61-90 days', value: report.days61to90 },
    { label: '91-120 days', value: report.days91to120 },
    { label: 'Over 120 days', value: report.over120Days },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Aged Receivables</h2>
          <p className="text-sm text-gray-600">
            As of {report.asOfDate.toLocaleDateString()}
          </p>
        </div>
        <div className="space-x-2">
          <button
            onClick={() => onExport?.('csv')}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm font-medium"
          >
            Export CSV
          </button>
          <button
            onClick={() => onExport?.('pdf')}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-6">
          <p className="text-sm text-gray-600 mb-2">Total Outstanding</p>
          <p className="text-2xl font-bold text-red-600">
            {formatCurrency(report.totalOutstanding)}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            {report.receivables.length} invoices
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-600 mb-2">Days Sales Outstanding</p>
          <p className="text-2xl font-bold">
            {Math.round(
              report.receivables.reduce((sum, r) => sum + r.daysOutstanding, 0) /
                (report.receivables.length || 1)
            )}{' '}
            days
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-600 mb-2">Average Invoice</p>
          <p className="text-2xl font-bold">
            {formatCurrency(
              report.totalOutstanding / (report.receivables.length || 1)
            )}
          </p>
        </Card>
      </div>

      {/* Aging Buckets Summary */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Aging Summary</h3>
        <div className="space-y-3">
          {agingBuckets.map((bucket) => (
            <div key={bucket.label} className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-medium">{bucket.label}</span>
                <span className="text-right">
                  {formatCurrency(bucket.value)}
                  {' '}
                  <span className="text-gray-600 text-sm">
                    {formatPercent(bucket.value / report.totalOutstanding)}
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    bucket.label.includes('Current')
                      ? 'bg-green-500'
                      : bucket.label.includes('31-60')
                      ? 'bg-yellow-500'
                      : bucket.label.includes('61-90')
                      ? 'bg-orange-500'
                      : 'bg-red-500'
                  }`}
                  style={{
                    width: `${
                      report.totalOutstanding > 0
                        ? (bucket.value / report.totalOutstanding) * 100
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Receivables Detail */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Receivables Detail</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-4">Customer</th>
                <th className="text-left py-2 px-4">Invoice #</th>
                <th className="text-right py-2 px-4">Amount</th>
                <th className="text-right py-2 px-4">Outstanding</th>
                <th className="text-right py-2 px-4">Days</th>
                <th className="text-left py-2 px-4">Aging</th>
              </tr>
            </thead>
            <tbody>
              {report.receivables.slice(0, 20).map((receivable, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-4">{receivable.customerName}</td>
                  <td className="py-2 px-4">{receivable.invoiceId.toString()}</td>
                  <td className="py-2 px-4 text-right">
                    {formatCurrency(receivable.amount)}
                  </td>
                  <td className="py-2 px-4 text-right font-medium">
                    {formatCurrency(receivable.outstandingAmount)}
                  </td>
                  <td className="py-2 px-4 text-right">
                    {receivable.daysOutstanding}
                  </td>
                  <td className="py-2 px-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        receivable.agingBucket === 'Current'
                          ? 'bg-green-100 text-green-700'
                          : receivable.agingBucket === '31-60 days'
                          ? 'bg-yellow-100 text-yellow-700'
                          : receivable.agingBucket === '61-90 days'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {receivable.agingBucket}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {report.receivables.length > 20 && (
          <p className="text-sm text-gray-600 mt-4">
            Showing 20 of {report.receivables.length} receivables
          </p>
        )}
      </Card>
    </div>
  );
}
