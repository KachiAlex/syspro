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
          apiData.attribution = attr.summary ?? attr;
        }
        if (performanceRes.ok) {
          const perf = await performanceRes.json();
          apiData.performance = perf.snapshot ?? perf;
        }
        if (campaignsRes.ok) {
          const camps = await campaignsRes.json();
          apiData.campaigns = Array.isArray(camps.campaigns) ? camps.campaigns : [];
        }

        const campaignList: any[] = Array.isArray(apiData.campaigns) ? apiData.campaigns : [];
        const attrSummary = apiData.attribution ?? {};
        const perfSnapshot = apiData.performance ?? {};

        const totalRevenue = Number(attrSummary?.totals?.revenue ?? 0);
        const pipelineValue = Number(perfSnapshot?.pipelineCoverage ?? 0) * Number(perfSnapshot?.avgDealSize ?? 0);

        const channels = Array.isArray(attrSummary?.channels)
          ? attrSummary.channels.map((ch: any) => ({
              name: ch.channel,
              revenue: Number(ch.revenue ?? 0),
              percentage: totalRevenue > 0 ? Math.round((Number(ch.revenue ?? 0) / totalRevenue) * 100) : 0,
            }))
          : [];

        const topCampaigns = Array.isArray(attrSummary?.campaigns)
          ? attrSummary.campaigns
              .slice()
              .sort((a: any, b: any) => Number(b.revenue ?? 0) - Number(a.revenue ?? 0))
              .slice(0, 3)
              .map((c: any) => ({
                name: c.name ?? "Unknown",
                roi: Number(c.roi ?? 0),
                revenue: Number(c.revenue ?? 0),
              }))
          : [];

        const overview: OverviewData = {
          totalRevenue,
          pipelineValue,
          campaignsActive: campaignList.filter((c: any) => c.status === "active").length,
          winRate: Number(perfSnapshot?.winRate ?? 0),
          avgDealSize: Number(perfSnapshot?.avgDealSize ?? 0),
          dealVelocityDays: Number(perfSnapshot?.dealVelocityDays ?? 0),
          channels,
          topCampaigns,
        };

        setData(overview);
        onError("");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load overview data";
        onError(message);
        setData(null);
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
        <AlertCircle className="w-12 h-12 text-theme-text-tertiary mx-auto mb-4" />
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
            className="flex items-center gap-2 px-4 py-2 bg-theme-muted border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-900 font-medium transition"
          >
            Create Campaign <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigateTab?.("forecasting")}
            className="flex items-center gap-2 px-4 py-2 bg-theme-muted border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-900 font-medium transition"
          >
            View Forecasts <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onExportReport?.()}
            className="flex items-center gap-2 px-4 py-2 bg-theme-muted border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-900 font-medium transition"
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
    <div className="bg-theme-muted border border-gray-200 rounded-lg p-4">
      <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
      <p className={`text-sm mt-2 ${changePositive ? "text-green-600" : "text-gray-600"}`}>{change}</p>
    </div>
  );
}
