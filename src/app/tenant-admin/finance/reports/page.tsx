"use client";

import React, { useState, useEffect } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import {
  Download,
  BarChart3,
  LineChart,
  PieChart,
  TrendingUp,
  Calendar,
  FileText,
  DollarSign,
} from "lucide-react";

interface ReportMeta {
  id: string;
  name: string;
  description: string;
  type: "income_statement" | "balance_sheet" | "cash_flow" | "expense_breakdown";
  lastGenerated: string;
  icon?: React.ReactNode;
}

export default function FinanceReportsPage() {
  const { tenantSlug } = useTenantContext();
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatedReport, setGeneratedReport] = useState<any>(null);

  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    setStartDate(firstDay);
    setEndDate(lastDay);
  }, []);

  useEffect(() => {
    if (!tenantSlug) return;
    async function loadReports() {
      setLoading(true);
      try {
        const res = await fetch(`/api/finance/reports?tenantSlug=${encodeURIComponent(tenantSlug)}`);
        if (res.ok) {
          const data = await res.json();
          setReports(data.reports || []);
        }
      } catch (err) {
        console.error('Failed to load reports:', err);
      } finally {
        setLoading(false);
      }
    }
    loadReports();
  }, [tenantSlug]);

  const getReportIcon = (type?: string) => {
    switch (type) {
      case 'income_statement': return <TrendingUp className="h-8 w-8 text-blue-600" />;
      case 'balance_sheet': return <DollarSign className="h-8 w-8 text-green-600" />;
      case 'cash_flow': return <LineChart className="h-8 w-8 text-purple-600" />;
      case 'expense_breakdown': return <PieChart className="h-8 w-8 text-orange-600" />;
      default: return <FileText className="h-8 w-8 text-gray-600" />;
    }
  };

  const handleExportReport = async (report: ReportMeta) => {
    if (!tenantSlug) return;
    try {
      const res = await fetch(`/api/finance/reports/${encodeURIComponent(report.id)}/export?tenantSlug=${encodeURIComponent(tenantSlug)}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.name.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setAlert({ type: 'success', message: `${report.name} exported successfully` });
    } catch (err) {
      setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Export failed' });
    }
  };

  const handleGenerateReport = async () => {
    if (!tenantSlug || !startDate || !endDate) return;
    setIsGenerating(true);
    setAlert(null);
    try {
      const res = await fetch('/api/finance/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug, period: selectedPeriod, startDate, endDate }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to generate report');
      setGeneratedReport(payload.report || null);
      setAlert({
        type: 'success',
        message: `Financial report generated successfully for ${selectedPeriod} period (${startDate} to ${endDate})`
      });
    } catch (error) {
      setAlert({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to generate report. Please try again.'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Alert */}
        {alert && (
          <div className={`mb-6 p-4 rounded-lg border ${
            alert.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center justify-between">
              <span>{alert.message}</span>
              <button 
                onClick={() => setAlert(null)}
                className="text-current hover:opacity-70"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black">Finance Reports</h1>
          <p className="text-black mt-2">Generate and analyze financial statements</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Period
              </label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="month">Month</option>
                <option value="quarter">Quarter</option>
                <option value="year">Year</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-black mb-2">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end">
              <button 
                onClick={handleGenerateReport}
                disabled={isGenerating || !startDate || !endDate}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" />
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>

        {/* Reports Grid */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading reports...</div>
        ) : reports.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {reports.map((report) => (
              <div
                key={report.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    {report.icon || getReportIcon(report.type)}
                    <div>
                      <h3 className="text-lg font-bold text-black">{report.name}</h3>
                      <p className="text-sm text-black mt-1">{report.description}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <p className="text-xs text-black">
                    Last generated: {new Date(report.lastGenerated).toLocaleDateString()}
                  </p>
                  <button
                    onClick={() => handleExportReport(report)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg transition"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center mb-8">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reports Available</h3>
            <p className="text-gray-500">Generate a report using the filters above to see results here.</p>
          </div>
        )}

        {/* Generated Report Preview */}
        {generatedReport && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-2xl font-bold text-black mb-6">Generated Report Preview</h2>
            {generatedReport.totalRevenue !== undefined && (
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <p className="text-black font-medium">Total Revenue</p>
                  <p className="text-lg font-bold text-green-600">
                    ${(generatedReport.totalRevenue || 0).toLocaleString()}
                  </p>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <p className="text-black font-medium">Total Expenses</p>
                  <p className="text-lg font-bold text-red-600">
                    -${(generatedReport.totalExpenses || 0).toLocaleString()}
                  </p>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-200 bg-gray-50 px-4">
                  <p className="text-black font-bold">Net Income</p>
                  <p className="text-lg font-bold text-blue-600">
                    ${(generatedReport.netIncome || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
            {generatedReport.totalAssets !== undefined && (
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <p className="text-black font-medium">Total Assets</p>
                  <p className="text-lg font-bold text-green-600">
                    ${(generatedReport.totalAssets || 0).toLocaleString()}
                  </p>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <p className="text-black font-medium">Total Liabilities</p>
                  <p className="text-lg font-bold text-red-600">
                    ${(generatedReport.totalLiabilities || 0).toLocaleString()}
                  </p>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-200 bg-gray-50 px-4">
                  <p className="text-black font-bold">Total Equity</p>
                  <p className="text-lg font-bold text-blue-600">
                    ${(generatedReport.totalEquity || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
            {generatedReport.netCashChange !== undefined && (
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <p className="text-black font-medium">Net Cash Change</p>
                  <p className="text-lg font-bold text-blue-600">
                    ${(generatedReport.netCashChange || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
            {generatedReport.totalOutstanding !== undefined && (
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <p className="text-black font-medium">Total Outstanding</p>
                  <p className="text-lg font-bold text-orange-600">
                    ${(generatedReport.totalOutstanding || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
