"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  X,
  AlertTriangle,
  Loader2,
  TrendingUp,
  AlertCircle,
  Eye,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Calendar,
  DollarSign,
} from "lucide-react";
import {
  Budget,
  BudgetLine,
  BudgetSummary,
  BudgetLineVariance,
  BudgetVariance,
  BudgetForecast,
  BUDGET_TYPES,
  BUDGET_PERIOD_TYPES,
  ENFORCEMENT_MODES,
} from "@/lib/finance/budgets";

interface BudgetPlanningWorkspaceProps {
  tenantSlug: string;
}

export default function BudgetPlanningWorkspace({
  tenantSlug,
}: BudgetPlanningWorkspaceProps) {
  // State Management
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [summaries, setSummaries] = useState<BudgetSummary[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<BudgetSummary | null>(
    null
  );
  const [budgetLines, setBudgetLines] = useState<BudgetLineVariance[]>([]);
  const [variances, setVariances] = useState<BudgetVariance[]>([]);
  const [forecasts, setForecasts] = useState<BudgetForecast[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBudgetId, setExpandedBudgetId] = useState<bigint | null>(null);

  // Tab and Modal state
  const [activeTab, setActiveTab] = useState<"planning" | "tracking" | "forecasting">(
    "planning"
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showForecastModal, setShowForecastModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    budgetType: BUDGET_TYPES[0],
    periodType: BUDGET_PERIOD_TYPES[0],
    fiscalYear: new Date().getFullYear(),
    quarterNum: undefined,
    monthNum: undefined,
    totalBudgetAmount: 0,
    enforcementMode: ENFORCEMENT_MODES[0],
    budgetLines: [] as any[],
  });

  const [lineForm, setLineForm] = useState({
    accountCode: "",
    accountName: "",
    budgetedAmount: 0,
  });

  // Fetch budgets on mount
  useEffect(() => {
    fetchBudgets();
  }, [tenantSlug]);

  // Fetch data when budget is selected
  useEffect(() => {
    if (selectedBudget) {
      fetchBudgetDetails();
    }
  }, [selectedBudget]);

  // API Calls
  async function fetchBudgets() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/finance/budgets?tenantSlug=${tenantSlug}&withSummary=true`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch budgets");
      }

      const data = await response.json();
      setBudgets(data.budgets || []);
      setSummaries(data.summaries || []);

      if (data.summaries?.length > 0) {
        setSelectedBudget(data.summaries[0]);
      }
    } catch (err) {
      console.error("Error fetching budgets:", err);
      setError("Failed to load budgets");
    } finally {
      setLoading(false);
    }
  }

  async function fetchBudgetDetails() {
    if (!selectedBudget) return;

    try {
      // Fetch lines with variance
      const linesRes = await fetch(
        `/api/finance/budgets/${selectedBudget.id}/lines?tenantSlug=${tenantSlug}&withVariance=true`
      );
      const linesData = await linesRes.json();
      setBudgetLines(linesData.variances || linesData || []);

      // Fetch variances
      const variancesRes = await fetch(
        `/api/finance/budgets/${selectedBudget.id}/variances?tenantSlug=${tenantSlug}`
      );
      const variancesData = await variancesRes.json();
      setVariances(Array.isArray(variancesData) ? variancesData : []);

      // Fetch forecasts
      const forecastsRes = await fetch(
        `/api/finance/budgets/${selectedBudget.id}/forecasts?tenantSlug=${tenantSlug}`
      );
      const forecastsData = await forecastsRes.json();
      setForecasts(Array.isArray(forecastsData) ? forecastsData : []);
    } catch (err) {
      console.error("Error fetching budget details:", err);
      setError("Failed to load budget details");
    }
  }

  async function createBudget() {
    try {
      setLoading(true);

      const payload = {
        ...formData,
        tenantId: BigInt(0), // Will be resolved server-side
      };

      const response = await fetch("/api/finance/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to create budget");
      }

      setShowCreateModal(false);
      setFormData({
        code: "",
        name: "",
        description: "",
        budgetType: BUDGET_TYPES[0],
        periodType: BUDGET_PERIOD_TYPES[0],
        fiscalYear: new Date().getFullYear(),
        quarterNum: undefined,
        monthNum: undefined,
        totalBudgetAmount: 0,
        enforcementMode: ENFORCEMENT_MODES[0],
        budgetLines: [],
      });

      await fetchBudgets();
    } catch (err) {
      console.error("Error creating budget:", err);
      setError("Failed to create budget");
    } finally {
      setLoading(false);
    }
  }

  async function generateForecast(type: string) {
    if (!selectedBudget) return;

    try {
      setLoading(true);

      const payload =
        type === "rolling"
          ? { generateRolling: true, basePeriods: 3 }
          : { forecastType: type, forecastLines: [] };

      const response = await fetch(
        `/api/finance/budgets/${selectedBudget.id}/forecasts?tenantSlug=${tenantSlug}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate forecast");
      }

      setShowForecastModal(false);
      await fetchBudgetDetails();
    } catch (err) {
      console.error("Error generating forecast:", err);
      setError("Failed to generate forecast");
    } finally {
      setLoading(false);
    }
  }

  async function acknowledgeVariance(varianceId: bigint) {
    if (!selectedBudget) return;

    try {
      const response = await fetch(
        `/api/finance/budgets/${selectedBudget.id}/variances?tenantSlug=${tenantSlug}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            varianceId,
            acknowledgedBy: "current-user",
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to acknowledge variance");
      }

      await fetchBudgetDetails();
    } catch (err) {
      console.error("Error acknowledging variance:", err);
      setError("Failed to acknowledge variance");
    }
  }

  // Add line to budget
  const addBudgetLine = () => {
    if (
      !lineForm.accountCode ||
      !lineForm.accountName ||
      lineForm.budgetedAmount <= 0
    ) {
      setError("All line fields are required");
      return;
    }

    setFormData({
      ...formData,
      budgetLines: [
        ...formData.budgetLines,
        { ...lineForm, lineNumber: formData.budgetLines.length + 1 },
      ],
    });

    setLineForm({ accountCode: "", accountName: "", budgetedAmount: 0 });
  };

  // Remove line from budget
  const removeBudgetLine = (index: number) => {
    setFormData({
      ...formData,
      budgetLines: formData.budgetLines.filter((_, i) => i !== index),
    });
  };

  // UI Helpers
  const getVarianceColor = (percent: number) => {
    if (percent > 100) return "text-red-600";
    if (percent > 80) return "text-yellow-600";
    return "text-green-600";
  };

  const getAlertColor = (level: string) => {
    switch (level) {
      case "CRITICAL":
        return "bg-red-50 border-red-200";
      case "WARNING":
        return "bg-yellow-50 border-yellow-200";
      default:
        return "bg-blue-50 border-blue-200";
    }
  };

  // Render sections
  if (loading && budgets.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading budgets...</p>
        </div>
      </div>
    );
  }

  if (error && budgets.length === 0) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Budget Planning & Forecasting
          </h1>
          <p className="text-gray-600 mt-1">
            Manage budgets, track actuals, and forecast future spending
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          New Budget
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-300">
        {["planning", "tracking", "forecasting"].map((tab) => (
          <button
            key={tab}
            onClick={() =>
              setActiveTab(tab as "planning" | "tracking" | "forecasting")
            }
            className={`px-4 py-2 font-medium capitalize ${
              activeTab === tab
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {/* PLANNING TAB */}
        {activeTab === "planning" && (
          <div className="space-y-6">
            {/* Budget List */}
            <div className="grid gap-4">
              {summaries.length === 0 ? (
                <div className="text-center p-12 bg-white rounded-lg border border-gray-200">
                  <BarChart3 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-600">No budgets created yet</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Create your first budget to get started
                  </p>
                </div>
              ) : (
                summaries.map((summary) => (
                  <div
                    key={summary.id}
                    className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300"
                  >
                    <div
                      className="cursor-pointer flex items-center justify-between"
                      onClick={() => setSelectedBudget(summary)}
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {summary.name} ({summary.code})
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {summary.budgetType} • {summary.periodType}{" "}
                          {summary.fiscalYear}
                        </p>
                        <div className="mt-3 flex gap-6">
                          <div>
                            <p className="text-xs text-gray-600">Total Budget</p>
                            <p className="font-semibold text-gray-900">
                              ${summary.totalBudgetAmount.toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Actual</p>
                            <p className="font-semibold text-gray-900">
                              ${summary.totalActual.toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Remaining</p>
                            <p
                              className={`font-semibold ${getVarianceColor(
                                summary.percentUtilized
                              )}`}
                            >
                              ${summary.remainingBalance.toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Utilized</p>
                            <p
                              className={`font-semibold ${getVarianceColor(
                                summary.percentUtilized
                              )}`}
                            >
                              {summary.percentUtilized.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4">
                        {selectedBudget?.id === summary.id ? (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Budget Details (when expanded) */}
                    {selectedBudget?.id === summary.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                        {/* Budget Lines Table */}
                        {budgetLines.length > 0 && (
                          <div>
                            <h4 className="font-medium text-gray-900 mb-3">
                              Budget Lines
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-3 py-2 text-left">
                                      Account
                                    </th>
                                    <th className="px-3 py-2 text-right">
                                      Budgeted
                                    </th>
                                    <th className="px-3 py-2 text-right">
                                      Actual
                                    </th>
                                    <th className="px-3 py-2 text-right">
                                      Remaining
                                    </th>
                                    <th className="px-3 py-2 text-right">
                                      % Utilized
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {budgetLines.map((line) => (
                                    <tr
                                      key={line.budgetLineId}
                                      className="border-b border-gray-200 hover:bg-gray-50"
                                    >
                                      <td className="px-3 py-2">
                                        <p className="font-medium">
                                          {line.accountCode}
                                        </p>
                                        <p className="text-gray-600">
                                          {line.accountName}
                                        </p>
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        ${line.budgetedAmount.toFixed(2)}
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        ${line.actualAmount.toFixed(2)}
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        <span
                                          className={`font-medium ${getVarianceColor(
                                            line.percentUtilized
                                          )}`}
                                        >
                                          ${line.remainingBalance.toFixed(2)}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        <span
                                          className={`font-medium ${getVarianceColor(
                                            line.percentUtilized
                                          )}`}
                                        >
                                          {line.percentUtilized.toFixed(1)}%
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TRACKING TAB */}
        {activeTab === "tracking" && selectedBudget && (
          <div className="space-y-6">
            {/* Budget Summary Card */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {selectedBudget.name}
              </h2>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Budget</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${selectedBudget.totalBudgetAmount.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Actual Spent</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${selectedBudget.totalActual.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Committed</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${selectedBudget.totalCommitted.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Remaining</p>
                  <p
                    className={`text-2xl font-bold ${getVarianceColor(
                      selectedBudget.percentUtilized
                    )}`}
                  >
                    ${selectedBudget.remainingBalance.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-6">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-medium text-gray-700">
                    Budget Utilization
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedBudget.percentUtilized.toFixed(1)}%
                  </p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      selectedBudget.percentUtilized > 100
                        ? "bg-red-600"
                        : selectedBudget.percentUtilized > 80
                        ? "bg-yellow-600"
                        : "bg-green-600"
                    }`}
                    style={{
                      width: `${Math.min(selectedBudget.percentUtilized, 100)}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Variances */}
            {variances.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">Budget Variances</h3>
                {variances.map((variance) => (
                  <div
                    key={variance.id}
                    className={`border rounded-lg p-4 ${getAlertColor(
                      variance.alertLevel
                    )}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {variance.varianceType}
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          Variance: ${variance.varianceAmount.toFixed(2)}{" "}
                          ({variance.variancePercent.toFixed(1)}%)
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Budgeted: ${variance.budgetedAmount?.toFixed(2) || "0.00"} |
                          Actual: ${variance.actualAmount?.toFixed(2) || "0.00"} |
                          Committed: ${variance.committedAmount?.toFixed(2) || "0.00"}
                        </p>
                      </div>
                      {!variance.isAcknowledged && (
                        <button
                          onClick={() => acknowledgeVariance(BigInt(variance.id!))}
                          className="text-sm bg-white px-3 py-1 rounded hover:bg-gray-100 ml-4"
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {variances.length === 0 && (
              <div className="text-center p-6 bg-white rounded-lg border border-gray-200">
                <AlertCircle className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-600">No variances detected</p>
              </div>
            )}
          </div>
        )}

        {/* FORECASTING TAB */}
        {activeTab === "forecasting" && selectedBudget && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">
                {selectedBudget.name} - Forecasts
              </h2>
              <button
                onClick={() => setShowForecastModal(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <TrendingUp className="h-5 w-5" />
                Generate Forecast
              </button>
            </div>

            {forecasts.length === 0 ? (
              <div className="text-center p-12 bg-white rounded-lg border border-gray-200">
                <TrendingUp className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No forecasts available</p>
                <p className="text-sm text-gray-500 mt-1">
                  Generate a forecast to see projections
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {forecasts.map((forecast) => (
                  <div
                    key={forecast.id}
                    className="bg-white rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {forecast.forecastType === "ROLLING"
                            ? "Rolling Forecast"
                            : forecast.scenarioName || "Scenario Forecast"}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Methodology: {forecast.methodology || "Custom"} • Created:{" "}
                          {new Date(forecast.createdAt!).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded text-sm font-medium ${
                          forecast.confidenceLevel === "HIGH"
                            ? "bg-green-100 text-green-700"
                            : forecast.confidenceLevel === "MEDIUM"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {forecast.confidenceLevel} Confidence
                      </span>
                    </div>

                    {forecast.forecastLines.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {forecast.forecastLines.slice(0, 3).map((line, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between text-sm py-1"
                          >
                            <span className="text-gray-600">
                              Line {line.budgetLineId}
                            </span>
                            <span className="font-medium text-gray-900">
                              ${line.forecastedAmount.toFixed(2)}
                            </span>
                          </div>
                        ))}
                        {forecast.forecastLines.length > 3 && (
                          <p className="text-sm text-gray-500 pt-2">
                            +{forecast.forecastLines.length - 3} more lines
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CREATE BUDGET MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Create New Budget
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Budget Code
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="BUDGET-2024-01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Budget Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Q1 2024 Budget"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Budget description..."
                />
              </div>

              {/* Period and Type */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Period Type
                  </label>
                  <select
                    value={formData.periodType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        periodType: e.target.value as any,
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {BUDGET_PERIOD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Budget Type
                  </label>
                  <select
                    value={formData.budgetType}
                    onChange={(e) =>
                      setFormData({ ...formData, budgetType: e.target.value as any })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {BUDGET_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fiscal Year
                  </label>
                  <input
                    type="number"
                    value={formData.fiscalYear}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        fiscalYear: parseInt(e.target.value),
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Budget Amount & Enforcement */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Budget Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                    <input
                      type="number"
                      value={formData.totalBudgetAmount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          totalBudgetAmount: parseFloat(e.target.value),
                        })
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 pl-7 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Enforcement Mode
                  </label>
                  <select
                    value={formData.enforcementMode}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        enforcementMode: e.target.value as any,
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {ENFORCEMENT_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Budget Lines Section */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">Budget Lines</h3>

                {/* Add Line Form */}
                <div className="bg-gray-50 p-3 rounded-lg mb-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Account Code (e.g., 5010)"
                      value={lineForm.accountCode}
                      onChange={(e) =>
                        setLineForm({
                          ...lineForm,
                          accountCode: e.target.value,
                        })
                      }
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Account Name"
                      value={lineForm.accountName}
                      onChange={(e) =>
                        setLineForm({
                          ...lineForm,
                          accountName: e.target.value,
                        })
                      }
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <input
                        type="number"
                        placeholder="Amount"
                        value={
                          lineForm.budgetedAmount === 0
                            ? ""
                            : lineForm.budgetedAmount
                        }
                        onChange={(e) =>
                          setLineForm({
                            ...lineForm,
                            budgetedAmount: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <button
                      onClick={addBudgetLine}
                      className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700"
                    >
                      Add Line
                    </button>
                  </div>
                </div>

                {/* Lines List */}
                {formData.budgetLines.length > 0 && (
                  <div className="space-y-2">
                    {formData.budgetLines.map((line, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm"
                      >
                        <div>
                          <p className="font-medium">{line.accountCode}</p>
                          <p className="text-gray-600">{line.accountName}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">
                            ${line.budgetedAmount.toFixed(2)}
                          </span>
                          <button
                            onClick={() => removeBudgetLine(idx)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createBudget}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create Budget"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORECAST MODAL */}
      {showForecastModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Generate Forecast
              </h2>
              <button
                onClick={() => setShowForecastModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <button
                onClick={() => {
                  generateForecast("rolling");
                }}
                className="w-full p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-left"
              >
                <p className="font-medium text-gray-900">Rolling Forecast</p>
                <p className="text-sm text-gray-600">
                  Average of last N periods
                </p>
              </button>

              <button
                onClick={() => {
                  generateForecast("trend_based");
                }}
                className="w-full p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-left"
              >
                <p className="font-medium text-gray-900">Trend-Based</p>
                <p className="text-sm text-gray-600">Projection from trends</p>
              </button>

              <button
                onClick={() => {
                  generateForecast("scenario");
                }}
                className="w-full p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-left"
              >
                <p className="font-medium text-gray-900">Scenario</p>
                <p className="text-sm text-gray-600">Custom scenario analysis</p>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
