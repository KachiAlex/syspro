"use client";

import React, { useState } from "react";
import { BarChart3, Target, TrendingUp, Users, Zap } from "lucide-react";
import { FormAlert } from "@/components/form";
import OverviewTab from "./marketing-sales/overview-tab";
import CampaignsTab from "./marketing-sales/campaigns-tab";
import AttributionTab from "./marketing-sales/attribution-tab";
import SalesPerformanceTab from "./marketing-sales/sales-performance-tab";
import ForecastingTab from "./marketing-sales/forecasting-tab";

type Tab = "overview" | "campaigns" | "attribution" | "performance" | "forecasting";

const TABS: Array<{ key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "campaigns", label: "Campaigns", icon: Target },
  { key: "attribution", label: "Attribution", icon: TrendingUp },
  { key: "performance", label: "Sales Performance", icon: Users },
  { key: "forecasting", label: "Forecasting", icon: Zap },
];

export default function MarketingSalesDashboard({ tenantSlug }: { tenantSlug?: string | null }) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [error, setError] = useState<string | null>(null);
  const [showCreateCampaignFromOverview, setShowCreateCampaignFromOverview] = useState(false);
  const ts = tenantSlug ;

  const handleNavigateTab = (tab: "campaigns" | "forecasting") => {
    setActiveTab(tab);
  };

  const handleOpenCreateCampaign = () => {
    setActiveTab("campaigns");
    // We'll use a ref or callback to trigger the modal in CampaignsTab
    setShowCreateCampaignFromOverview(true);
  };

  const handleExportReport = async () => {
    try {
      // Generate CSV export with dashboard data
      const csvContent = "data:text/csv;charset=utf-8," +
        "Marketing & Sales Dashboard Report\n" +
        "Generated on: " + new Date().toISOString() + "\n\n" +
        "This feature will export dashboard metrics to CSV.";
      
      const link = document.createElement("a");
      link.setAttribute("href", encodeURI(csvContent));
      link.setAttribute("download", `marketing-sales-report-${new Date().toISOString().split('T')[0]}.csv`);
      link.click();
    } catch (err) {
      setError("Failed to export report");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-theme-text-primary">Marketing & Sales</h1>
        <p className="text-theme-text-secondary mt-1">Revenue intelligence, campaigns, and sales performance</p>
      </div>

      {/* Error Alert */}
      {error && (
        <FormAlert
          type="error"
          title="Error"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 bg-theme-muted rounded-lg shadow-sm">
        <div className="flex flex-wrap gap-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-900 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-theme-muted rounded-lg shadow-sm">
        {activeTab === "overview" && (
          <OverviewTab
            tenantSlug={ts ?? ''}
            onError={setError}
            onNavigateTab={handleNavigateTab}
            onOpenCreateCampaign={handleOpenCreateCampaign}
            onExportReport={handleExportReport}
          />
        )}
        {activeTab === "campaigns" && (
          <CampaignsTab
            tenantSlug={ts ?? ''}
            onError={setError}
            autoOpenCreate={showCreateCampaignFromOverview}
            onAutoOpenCleared={() => setShowCreateCampaignFromOverview(false)}
          />
        )}
        {activeTab === "attribution" && <AttributionTab tenantSlug={ts ?? ''} onError={setError} />}
        {activeTab === "performance" && <SalesPerformanceTab tenantSlug={ts ?? ''} onError={setError} />}
        {activeTab === "forecasting" && <ForecastingTab tenantSlug={ts ?? ''} onError={setError} />}
      </div>
    </div>
  );
}
