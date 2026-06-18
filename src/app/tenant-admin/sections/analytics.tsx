"use client";

import { useEffect, useState } from "react";
import { FormAlert } from "@/components/form";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  ShoppingCart, 
  Target,
  Calendar,
  Download,
  Eye,
  Play,
  BarChart3,
  PieChart,
  Activity,
  FileText,
  AlertCircle,
  CheckCircle,
  Edit
} from "lucide-react";
import {
  ViewReportModal,
  EditReportModal,
  RunExportNowModal,
  EditExportModal,
} from "./analytics-modals";

type Report = { id: string; name: string; type: string; createdAt?: string; schedule?: string; rows?: number; dataPoints?: number };
type Export = { id: string; name: string; frequency: string; lastRun?: string; nextRun?: string; format: string };

const REPORT_TYPES: Record<string, { label: string; description: string; icon: string }> = {
  sales: { label: "Sales Report", description: "Revenue, deals, and pipeline analysis", icon: "📊" },
  inventory: { label: "Inventory Report", description: "Stock levels and movement analysis", icon: "📦" },
  expense: { label: "Expense Report", description: "Cost tracking and budget analysis", icon: "💰" },
  people: { label: "People Report", description: "Headcount, attendance, and HR metrics", icon: "👥" },
  financial: { label: "Financial Report", description: "P&L, balance sheet, and cash flow", icon: "📈" },
};

const EXPORT_FREQUENCIES: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export default function AnalyticsSection({ tenantSlug }: { tenantSlug?: string | null }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [exports, setExports] = useState<Export[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showNewReport, setShowNewReport] = useState(false);
  const [showNewExport, setShowNewExport] = useState(false);
  const [reportForm, setReportForm] = useState({ name: "", type: "" });
  const [exportForm, setExportForm] = useState({ name: "", frequency: "daily", format: "csv" });
  const [selectedPeriod, setSelectedPeriod] = useState("30d");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showViewReport, setShowViewReport] = useState(false);
  const [dashboardMetrics, setDashboardMetrics] = useState<{
    revenue?: { current: number; previous: number; growth: number; trend: string };
    customers?: { current: number; previous: number; growth: number; trend: string };
    orders?: { current: number; previous: number; growth: number; trend: string };
    conversion?: { current: number; previous: number; growth: number; trend: string };
    topProducts?: Array<{ name: string; sales: number; revenue: number }>;
    recentActivity?: Array<{ type: string; description: string; amount: string; time: string }>;
  }>({});
  const [showEditReport, setShowEditReport] = useState(false);
  const [selectedExport, setSelectedExport] = useState<Export | null>(null);
  const [showRunExport, setShowRunExport] = useState(false);
  const [showEditExport, setShowEditExport] = useState(false);
  const [updatingReport, setUpdatingReport] = useState(false);
  const [updatingExport, setUpdatingExport] = useState(false);
  const [runningExport, setRunningExport] = useState(false);
  const ts = tenantSlug ;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenant/analytics?tenantSlug=${encodeURIComponent(ts ?? '')}`);
      const payload = await res.json().catch(() => null);
      if (res.ok && payload) {
        const data = payload.data || payload;
        setReports(data.reports ?? []);
        setExports(data.exports ?? []);
        setDashboardMetrics({
          revenue: data.revenue,
          customers: data.customers,
          orders: data.orders,
          conversion: data.conversion,
          topProducts: data.topProducts,
          recentActivity: data.recentActivity,
        });
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [ts]);

  async function createReport() {
    if (!reportForm.name.trim() || !reportForm.type) {
      setError("Report name and type are required");
      return;
    }
    try {
      const payload = Object.assign({}, reportForm, { type: "report" });
      const res = await fetch(`/api/tenant/analytics?tenantSlug=${encodeURIComponent(ts ?? '')}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create report");
      setReportForm({ name: "", type: "" });
      setShowNewReport(false);
      setSuccess("Report created successfully");
      setTimeout(() => setSuccess(null), 3000);
      load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to create report");
    }
  }

  async function deleteReport(id: string) {
    if (!confirm("Delete this report? This action cannot be undone.")) return;
    try {
      const res = await fetch(
        `/api/tenant/analytics?id=${encodeURIComponent(id)}&type=report&tenantSlug=${encodeURIComponent(ts ?? '')}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete report");
      setSuccess("Report deleted");
      setTimeout(() => setSuccess(null), 3000);
      load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to delete report");
    }
  }

  async function createExport() {
    if (!exportForm.name.trim()) {
      setError("Export name is required");
      return;
    }
    try {
      const payload = Object.assign({}, exportForm, { type: "export" });
      const res = await fetch(`/api/tenant/analytics?tenantSlug=${encodeURIComponent(ts ?? '')}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create export");
      setExportForm({ name: "", frequency: "daily", format: "csv" });
      setShowNewExport(false);
      setSuccess("Scheduled export created");
      setTimeout(() => setSuccess(null), 3000);
      load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to create export");
    }
  }

  async function deleteExport(id: string) {
    if (!confirm("Stop this export? It will no longer be sent.")) return;
    try {
      const res = await fetch(
        `/api/tenant/analytics?id=${encodeURIComponent(id)}&type=export&tenantSlug=${encodeURIComponent(ts ?? '')}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete export");
      setSuccess("Export removed");
      setTimeout(() => setSuccess(null), 3000);
      load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to delete export");
    }
  }

  async function handleViewReport(report: Report) {
    setSelectedReport(report);
    setShowViewReport(true);
  }

  async function handleDownloadReport(format: string) {
    if (!selectedReport) return;
    try {
      const res = await fetch(
        `/api/tenant/analytics?action=download&reportId=${encodeURIComponent(selectedReport.id)}&format=${encodeURIComponent(format)}&tenantSlug=${encodeURIComponent(ts ?? '')}`
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${selectedReport.name.replace(/\s+/g, "-").toLowerCase()}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setSuccess("Report downloaded successfully");
        setTimeout(() => setSuccess(null), 2000);
      } else {
        setError("Failed to download report");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to download report");
    }
  }

  async function handleEditReport(updates: { name?: string; schedule?: string }) {
    if (!selectedReport) return;
    setUpdatingReport(true);
    try {
      const res = await fetch(
        `/api/tenant/analytics?id=${encodeURIComponent(selectedReport.id)}&type=report&tenantSlug=${encodeURIComponent(ts ?? '')}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        }
      );
      if (!res.ok) throw new Error("Failed to update report");
      setSuccess("Report updated successfully");
      setTimeout(() => setSuccess(null), 3000);
      setShowEditReport(false);
      setShowViewReport(false);
      load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to update report");
    } finally {
      setUpdatingReport(false);
    }
  }

  async function handleRunExport(format?: string) {
    if (!selectedExport) return;
    setRunningExport(true);
    try {
      const res = await fetch(
        `/api/tenant/analytics?action=run_export&exportId=${encodeURIComponent(selectedExport.id)}&format=${encodeURIComponent(format || selectedExport.format)}&tenantSlug=${encodeURIComponent(ts ?? '')}`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Failed to run export");
      setSuccess("Export started successfully");
      setTimeout(() => setSuccess(null), 3000);
      setShowRunExport(false);
      load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to run export");
    } finally {
      setRunningExport(false);
    }
  }

  async function handleEditExport(updates: { name?: string; frequency?: string; format?: string }) {
    if (!selectedExport) return;
    setUpdatingExport(true);
    try {
      const res = await fetch(
        `/api/tenant/analytics?id=${encodeURIComponent(selectedExport.id)}&type=export&tenantSlug=${encodeURIComponent(ts ?? '')}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        }
      );
      if (!res.ok) throw new Error("Failed to update export");
      setSuccess("Export updated successfully");
      setTimeout(() => setSuccess(null), 3000);
      setShowEditExport(false);
      load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to update export");
    } finally {
      setUpdatingExport(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && <FormAlert type="error" title="Error" message={error} onClose={() => setError(null)} />}
      {success && <FormAlert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Analytics Dashboard Header */}
      <div className="rounded-3xl border border-slate-100 bg-[#111827] p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Dashboard</p>
            <h2 className="text-lg font-semibold text-gray-900">Analytics Overview</h2>
            <p className="mt-1 text-sm text-slate-600">Real-time insights and business metrics</p>
          </div>
          <div className="flex gap-2">
            <select 
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-white rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
            <button className="whitespace-nowrap rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Download className="w-4 h-4 mr-2 inline" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: "Revenue",
            value: `$${(dashboardMetrics.revenue?.current ?? 0).toLocaleString()}`,
            change: dashboardMetrics.revenue?.growth ?? 0,
            trend: dashboardMetrics.revenue?.trend ?? "up",
            icon: DollarSign,
            color: "text-green-600"
          },
          {
            title: "Customers",
            value: (dashboardMetrics.customers?.current ?? 0).toLocaleString(),
            change: dashboardMetrics.customers?.growth ?? 0,
            trend: dashboardMetrics.customers?.trend ?? "up",
            icon: Users,
            color: "text-blue-600"
          },
          {
            title: "Orders",
            value: (dashboardMetrics.orders?.current ?? 0).toLocaleString(),
            change: dashboardMetrics.orders?.growth ?? 0,
            trend: dashboardMetrics.orders?.trend ?? "up",
            icon: ShoppingCart,
            color: "text-purple-600"
          },
          {
            title: "Conversion Rate",
            value: `${dashboardMetrics.conversion?.current ?? 0}%`,
            change: dashboardMetrics.conversion?.growth ?? 0,
            trend: dashboardMetrics.conversion?.trend ?? "up",
            icon: Target,
            color: "text-orange-600"
          }
        ].map((metric, index) => (
          <div key={index} className="rounded-3xl border border-slate-100 bg-[#111827] p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">{metric.title}</p>
                <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                <div className="flex items-center mt-2">
                  {metric.trend === "up" ? (
                    <TrendingUp className={`w-4 h-4 mr-1 ${metric.color}`} />
                  ) : (
                    <TrendingDown className={`w-4 h-4 mr-1 text-red-600`} />
                  )}
                  <span className={`text-sm font-medium ${metric.trend === "up" ? "text-green-600" : "text-red-600"}`}>
                    {metric.change}%
                  </span>
                  <span className="text-sm text-slate-500 ml-1">vs last period</span>
                </div>
              </div>
              <metric.icon className={`w-8 h-8 ${metric.color} opacity-20`} />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="rounded-3xl border border-slate-100 bg-[#111827] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Revenue Trend</h3>
            <BarChart3 className="w-5 h-5 text-slate-400" />
          </div>
          <div className="h-64 flex items-center justify-center bg-slate-50 rounded-lg">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600">Revenue chart visualization</p>
              <p className="text-xs text-slate-500 mt-1">Interactive chart would render here</p>
            </div>
          </div>
        </div>

        {/* Sales Distribution */}
        <div className="rounded-3xl border border-slate-100 bg-[#111827] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Sales Distribution</h3>
            <PieChart className="w-5 h-5 text-slate-400" />
          </div>
          <div className="h-64 flex items-center justify-center bg-slate-50 rounded-lg">
            <div className="text-center">
              <PieChart className="w-12 h-12 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600">Sales by category pie chart</p>
              <p className="text-xs text-slate-500 mt-1">Interactive chart would render here</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Products and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="rounded-3xl border border-slate-100 bg-[#111827] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Top Products</h3>
            <TrendingUp className="w-5 h-5 text-slate-400" />
          </div>
          <div className="space-y-3">
            {(dashboardMetrics.topProducts ?? []).map((product, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{product.name}</p>
                    <p className="text-sm text-slate-600">{product.sales} units sold</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">${product.revenue.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-3xl border border-slate-100 bg-[#111827] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <Activity className="w-5 h-5 text-slate-400" />
          </div>
          <div className="space-y-3">
            {(dashboardMetrics.recentActivity ?? []).map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    activity.type === "sale" ? "bg-green-100 text-green-600" :
                    activity.type === "customer" ? "bg-blue-100 text-blue-600" :
                    "bg-orange-100 text-orange-600"
                  }`}>
                    {activity.type === "sale" ? <ShoppingCart className="w-4 h-4" /> :
                     activity.type === "customer" ? <Users className="w-4 h-4" /> :
                     <AlertCircle className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{activity.description}</p>
                    <p className="text-sm text-slate-600">{activity.time}</p>
                  </div>
                </div>
                {activity.amount && (
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{activity.amount}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reports */}
      <div className="rounded-3xl border border-slate-100 bg-[#111827] p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Insights</p>
            <h2 className="text-lg font-semibold text-gray-900">Reports</h2>
            <p className="mt-1 text-sm text-slate-600">Create custom reports to analyze your business data</p>
          </div>
          <button
            onClick={() => {
              setShowNewReport(!showNewReport);
              setReportForm({ name: "", type: "" });
            }}
            className="whitespace-nowrap rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {showNewReport ? "Cancel" : "+ New Report"}
          </button>
        </div>

        {showNewReport && (
          <div className="mt-4 space-y-4 border-t pt-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Report Name</label>
              <input
                type="text"
                value={reportForm.name}
                onChange={(e) => setReportForm({ ...reportForm, name: e.target.value })}
                placeholder="e.g., Q4 Sales Analysis"
                className="bg-white w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Report Type</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(REPORT_TYPES).map(([key, { label, description, icon }]) => (
                  <button
                    key={key}
                    onClick={() => setReportForm({ ...reportForm, type: key })}
                    className={`rounded-lg border-2 p-3 text-left transition-all ${
                      reportForm.type === key
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-lg">{icon}</div>
                    <div className="mt-1 font-medium text-sm text-gray-900">{label}</div>
                    <div className="text-xs text-slate-600">{description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={createReport}
                className="rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Create Report
              </button>
              <button
                onClick={() => {
                  setShowNewReport(false);
                  setReportForm({ name: "", type: "" });
                }}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="mt-4">
          {loading ? (
            <div className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-600">
              <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"></div>
              <p className="mt-2">Loading reports…</p>
            </div>
          ) : (reports ?? []).length === 0 ? (
            <div className="rounded-lg bg-blue-50 p-4 text-center text-sm">
              <p className="font-medium text-gray-900">No reports created yet</p>
              <p className="mt-1 text-blue-700">Create your first report to start analyzing data</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => {
                const reportType = REPORT_TYPES[r.type] || { label: r.type, icon: "📋" };
                return (
                  <div key={r.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{reportType.icon}</span>
                          <div>
                            <h3 className="font-semibold text-gray-900">{r.name}</h3>
                            <p className="text-sm text-slate-600">{reportType.label}</p>
                          </div>
                        </div>
                        {r.createdAt && (
                          <p className="mt-2 text-xs text-slate-500">
                            Created {new Date(r.createdAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewReport(r)}
                          className="rounded-full border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </button>
                        <button
                          onClick={() => {
                            setSelectedReport(r);
                            setShowEditReport(true);
                          }}
                          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                        >
                          <Edit className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => deleteReport(r.id)}
                          className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Scheduled Exports */}
      <div className="rounded-3xl border border-slate-100 bg-[#111827] p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Automation</p>
            <h2 className="text-lg font-semibold text-gray-900">Scheduled Exports</h2>
            <p className="mt-1 text-sm text-slate-600">Automatically export data at regular intervals</p>
          </div>
          <button
            onClick={() => {
              setShowNewExport(!showNewExport);
              setExportForm({ name: "", frequency: "daily", format: "csv" });
            }}
            className="whitespace-nowrap rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {showNewExport ? "Cancel" : "+ Schedule Export"}
          </button>
        </div>

        {showNewExport && (
          <div className="mt-4 space-y-3 border-t pt-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Export Name</label>
              <input
                type="text"
                value={exportForm.name}
                onChange={(e) => setExportForm({ ...exportForm, name: e.target.value })}
                placeholder="e.g., Daily Sales Export"
                className="bg-white w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Frequency</label>
                <select
                  value={exportForm.frequency}
                  onChange={(e) => setExportForm({ ...exportForm, frequency: e.target.value })}
                  className="bg-white w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {Object.entries(EXPORT_FREQUENCIES).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Format</label>
                <select
                  value={exportForm.format}
                  onChange={(e) => setExportForm({ ...exportForm, format: e.target.value })}
                  className="bg-white w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="csv">CSV</option>
                  <option value="excel">Excel</option>
                  <option value="pdf">PDF</option>
                  <option value="json">JSON</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={createExport}
                className="rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Schedule Export
              </button>
              <button
                onClick={() => {
                  setShowNewExport(false);
                  setExportForm({ name: "", frequency: "daily", format: "csv" });
                }}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="mt-4">
          {(exports ?? []).length === 0 ? (
            <div className="rounded-lg bg-blue-50 p-4 text-center text-sm">
              <p className="font-medium text-gray-900">No scheduled exports</p>
              <p className="mt-1 text-blue-700">Set up automated exports to receive data regularly</p>
            </div>
          ) : (
            <div className="space-y-3">
              {exports.map((e) => (
                <div key={e.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{e.name}</h3>
                      <div className="mt-2 space-y-1 text-sm text-slate-600">
                        <p>📅 Frequency: {EXPORT_FREQUENCIES[e.frequency] || e.frequency}</p>
                        <p>📄 Format: {e.format?.toUpperCase()}</p>
                        {e.lastRun && <p>⏱️ Last run: {new Date(e.lastRun).toLocaleDateString()}</p>}
                        {e.nextRun && <p>⏭️ Next run: {new Date(e.nextRun).toLocaleDateString()}</p>}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedExport(e);
                        setShowRunExport(true);
                      }}
                      className="rounded-full border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 flex items-center gap-1"
                    >
                      <Play className="w-3 h-3" />
                      Run Now
                    </button>
                    <button
                      onClick={() => {
                        setSelectedExport(e);
                        setShowEditExport(true);
                      }}
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                    >
                      <Edit className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => deleteExport(e.id)}
                      className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                    >
                      Stop
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* View Report Modal */}
      <ViewReportModal
        isOpen={showViewReport}
        onClose={() => {
          setShowViewReport(false);
          setSelectedReport(null);
        }}
        report={selectedReport}
        onDownload={handleDownloadReport}
        onEdit={() => {
          setShowViewReport(false);
          setShowEditReport(true);
        }}
      />

      {/* Edit Report Modal */}
      <EditReportModal
        isOpen={showEditReport}
        onClose={() => {
          setShowEditReport(false);
          setSelectedReport(null);
        }}
        report={selectedReport}
        onSave={handleEditReport}
        isLoading={updatingReport}
      />

      {/* Run Export Now Modal */}
      <RunExportNowModal
        isOpen={showRunExport}
        onClose={() => {
          setShowRunExport(false);
          setSelectedExport(null);
        }}
        exportJob={selectedExport}
        onRun={handleRunExport}
        isLoading={runningExport}
      />

      {/* Edit Export Modal */}
      <EditExportModal
        isOpen={showEditExport}
        onClose={() => {
          setShowEditExport(false);
          setSelectedExport(null);
        }}
        exportJob={selectedExport}
        onSave={handleEditExport}
        isLoading={updatingExport}
      />
    </div>
  );
}
