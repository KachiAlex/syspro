"use client";

import React, { useEffect, useState } from "react";
import { ArrowRight, TrendingUp, AlertCircle } from "lucide-react";

interface OverviewData {
  totalRevenue?: number;
  pipelineValue?: number;
  campaignsActive?: number;
  winRate?: number;
  avgDealSize?: number;
  dealVelocityDays?: number;
  channels?: Array<{ name: string; revenue: number; percentage: number }>;
  topCampaigns?: Array<{ name: string; roi: number; revenue: number }>;
}

export default function OverviewTab({
  tenantSlug,
  onError,
  onNavigateTab,
  onOpenCreateCampaign,
  onExportReport,
}: {
  tenantSlug: string;
  onError: (error: string) => void;
  onNavigateTab?: (tab: "campaigns" | "forecasting") => void;
  onOpenCreateCampaign?: () => void;
  onExportReport?: () => void;
}) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Fetch multiple data sources for overview
        const [attributionRes, performanceRes, campaignsRes] = await Promise.all([
          fetch(`/api/revops/attribution?tenantSlug=${encodeURIComponent(tenantSlug)}`),
          fetch(`/api/revops/sales-performance?tenantSlug=${encodeURIComponent(tenantSlug)}`),
          fetch(`/api/revops/campaigns?tenantSlug=${encodeURIComponent(tenantSlug)}`),
        ]);

        const apiData: any = {};
        if (attributionRes.ok) {
          const attr = await attributionRes.json();
          apiData.attribution = attr;
        }
        if (performanceRes.ok) {
          const perf = await performanceRes.json();
          apiData.performance = perf;
        }
        if (campaignsRes.ok) {
          const camps = await campaignsRes.json();
          apiData.campaigns = camps;
        }

        // Transform data for display
        const overview: OverviewData = {
          totalRevenue: apiData.attribution?.summary?.totalRevenue ?? 450000,
          pipelineValue: apiData.performance?.pipelineValue ?? 1200000,
          campaignsActive: Array.isArray(apiData.campaigns?.data)
            ? apiData.campaigns.data.filter((c: any) => c.status === "active").length
            : 5,
          winRate: apiData.performance?.winRate ?? 32,
          avgDealSize: apiData.performance?.avgDealSize ?? 45000,
          dealVelocityDays: apiData.performance?.dealVelocityDays ?? 24,
          channels: [
            { name: "Email", revenue: 180000, percentage: 40 },
            { name: "Paid Search", revenue: 135000, percentage: 30 },
            { name: "Events", revenue: 90000, percentage: 20 },
            { name: "Partnerships", revenue: 45000, percentage: 10 },
          ],
          topCampaigns: [
            { name: "Q1 Enterprise Push", roi: 3.2, revenue: 120000 },
            { name: "Summer Campaign", roi: 2.8, revenue: 95000 },
            { name: "Partner Co-marketing", roi: 2.1, revenue: 75000 },
          ],
        };

        setData(overview);
        onError("");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load overview data";
        onError(message);
        // Set demo data on error
        setData({
          totalRevenue: 450000,
          pipelineValue: 1200000,
          campaignsActive: 5,
          winRate: 32,
          avgDealSize: 45000,
          dealVelocityDays: 24,
          channels: [
            { name: "Email", revenue: 180000, percentage: 40 },
            { name: "Paid Search", revenue: 135000, percentage: 30 },
            { name: "Events", revenue: 90000, percentage: 20 },
            { name: "Partnerships", revenue: 45000, percentage: 10 },
          ],
          topCampaigns: [
            { name: "Q1 Enterprise Push", roi: 3.2, revenue: 120000 },
            { name: "Summer Campaign", roi: 2.8, revenue: 95000 },
            { name: "Partner Co-marketing", roi: 2.1, revenue: 75000 },
          ],
        });
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [tenantSlug, onError]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading overview...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Unable to load overview data</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          label="Total Revenue"
          value={`$${(data.totalRevenue! / 1000).toFixed(0)}K`}
          change="+12%"
          changePositive={true}
        />
        <KPICard
          label="Pipeline Value"
          value={`$${(data.pipelineValue! / 1000).toFixed(0)}K`}
          change="+8%"
          changePositive={true}
        />
        <KPICard
          label="Active Campaigns"
          value={data.campaignsActive!.toString()}
          change="2 pending"
          changePositive={false}
        />
        <KPICard label="Win Rate" value={`${data.winRate}%`} change="+2%" changePositive={true} />
        <KPICard
          label="Avg Deal Size"
          value={`$${(data.avgDealSize! / 1000).toFixed(0)}K`}
          change="+5%"
          changePositive={true}
        />
        <KPICard
          label="Deal Velocity"
          value={`${data.dealVelocityDays} days`}
          change="-3 days"
          changePositive={true}
        />
      </div>

      {/* Charts & Details Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue by Channel */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Channel</h3>
          <div className="space-y-3">
            {data.channels?.map((channel) => (
              <div key={channel.name}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">{channel.name}</span>
                  <span className="text-sm font-semibold text-gray-900">
                    ${(channel.revenue / 1000).toFixed(0)}K ({channel.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${channel.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Campaigns */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Campaigns</h3>
          <div className="space-y-3">
            {data.topCampaigns?.map((campaign, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
              >
                <div>
                  <p className="font-medium text-gray-900">{campaign.name}</p>
                  <p className="text-sm text-gray-600">Revenue: ${(campaign.revenue / 1000).toFixed(0)}K</p>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="font-semibold text-green-600">{campaign.roi.toFixed(1)}x ROI</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => onOpenCreateCampaign?.()}
            className="flex items-center gap-2 px-4 py-2 bg-[#111827] border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-900 font-medium transition"
          >
            Create Campaign <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigateTab?.("forecasting")}
            className="flex items-center gap-2 px-4 py-2 bg-[#111827] border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-900 font-medium transition"
          >
            View Forecasts <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onExportReport?.()}
            className="flex items-center gap-2 px-4 py-2 bg-[#111827] border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-900 font-medium transition"
          >
            Export Report <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function KPICard({
  label,
  value,
  change,
  changePositive,
}: {
  label: string;
  value: string;
  change: string;
  changePositive: boolean;
}) {
  return (
    <div className="bg-[#111827] border border-gray-200 rounded-lg p-4">
      <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
      <p className={`text-sm mt-2 ${changePositive ? "text-green-600" : "text-gray-600"}`}>{change}</p>
    </div>
  );
}
