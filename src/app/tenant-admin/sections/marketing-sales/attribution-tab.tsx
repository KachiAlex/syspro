"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, BarChart3 } from "lucide-react";

interface AttributionData {
  summary?: {
    totalRevenue: number;
    touchpoints: number;
    avgTouchesPerDeal: number;
  };
  byChannel?: Array<{ channel: string; revenue: number; deals: number; percentage: number }>;
  byModel?: Array<{ model: string; revenue: number; percentage: number }>;
}

export default function AttributionTab({
  tenantSlug,
  onError,
}: {
  tenantSlug: string;
  onError: (error: string) => void;
}) {
  const [data, setData] = useState<AttributionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [model, setModel] = useState<"first_touch" | "last_touch" | "linear">("first_touch");

  useEffect(() => {
    async function loadAttribution() {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/revops/attribution?model=${model}&tenantSlug=${encodeURIComponent(tenantSlug)}`
        );

        if (!res.ok) {
          throw new Error("Failed to fetch attribution data");
        }
        const responseData = await res.json();
        const summary = responseData.summary ?? responseData.data ?? responseData ?? {};

        const totalRevenue = Number(summary?.totals?.revenue ?? 0);
        const opportunities = Number(summary?.totals?.opportunities ?? 0);

        const channels = Array.isArray(summary?.channels)
          ? summary.channels.map((ch: any) => {
              const revenue = Number(ch.revenue ?? 0);
              const cpa = Number(ch.costPerAcquisition ?? 0);
              const deals = cpa > 0 ? Math.round(Number(ch.spend ?? 0) / cpa) : 0;
              return {
                channel: ch.channel ?? "Unknown",
                revenue,
                deals,
                percentage: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0,
              };
            })
          : [];

        const touchpoints = channels.reduce((sum: number, c: any) => sum + Number(c.deals ?? 0), 0) || opportunities;

        setData({
          summary: {
            totalRevenue,
            touchpoints,
            avgTouchesPerDeal: opportunities > 0 ? Number((touchpoints / opportunities).toFixed(1)) : 0,
          },
          byChannel: channels,
          byModel: [
            { model: model === "first_touch" ? "First Touch" : model === "last_touch" ? "Last Touch" : "Linear", revenue: totalRevenue, percentage: 100 },
          ],
        });
        onError("");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load attribution data";
        onError(message);
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    loadAttribution();
  }, [tenantSlug, model, onError]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-theme-border border-t-blue-600"></div>
        <p className="mt-4 text-theme-text-secondary">Loading attribution data...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-theme-text-tertiary mx-auto mb-4" />
        <p className="text-theme-text-secondary">Unable to load attribution data</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Model Selector */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-theme-text-primary">Attribution Model:</span>
        <div className="flex gap-3">
          {(["first_touch", "last_touch", "linear"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setModel(m)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                model === m
                  ? "bg-theme-accent text-white"
                  : "bg-blue-100 text-blue-700 hover:bg-blue-200"
              }`}
            >
              {m === "first_touch"
                ? "First Touch"
                : m === "last_touch"
                ? "Last Touch"
                : "Linear"}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          label="Total Revenue Attributed"
          value={`$${(data.summary?.totalRevenue! / 1000).toFixed(0)}K`}
        />
        <SummaryCard label="Total Touchpoints" value={data.summary?.touchpoints?.toString() ?? "0"} />
        <SummaryCard
          label="Avg Touches per Deal"
          value={data.summary?.avgTouchesPerDeal?.toFixed(1) ?? "0"}
        />
      </div>

      {/* Attribution by Channel */}
      <div className="border border-theme-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-5 h-5 text-theme-accent" />
          <h3 className="text-lg font-semibold text-theme-text-primary">Revenue by Channel</h3>
        </div>

        <div className="space-y-4">
          {data.byChannel?.map((item) => (
            <div key={item.channel}>
              <div className="flex justify-between mb-2">
                <span className="font-medium text-theme-text-primary">{item.channel}</span>
                <div className="text-right">
                  <p className="font-semibold text-theme-text-primary">${(item.revenue / 1000).toFixed(0)}K</p>
                  <p className="text-xs text-theme-text-secondary">{item.deals} deals</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 bg-theme-muted rounded-full h-3">
                  <div
                    className="bg-theme-accent h-3 rounded-full"
                    style={{ width: `${item.percentage}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium text-theme-text-secondary w-12 text-right">{item.percentage}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison Table */}
      <div className="border border-theme-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Top Performing Channels</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-theme-muted border-b border-theme-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-theme-text-primary">Channel</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-theme-text-primary">Revenue</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-theme-text-primary">Deals</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-theme-text-primary">Avg Value</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-theme-text-primary">Share</th>
              </tr>
            </thead>
            <tbody>
              {data.byChannel?.map((item) => (
                <tr key={item.channel} className="border-b border-theme-border hover:bg-theme-muted">
                  <td className="px-4 py-3 font-medium text-theme-text-primary">{item.channel}</td>
                  <td className="px-4 py-3 text-right text-theme-text-primary">${(item.revenue / 1000).toFixed(0)}K</td>
                  <td className="px-4 py-3 text-right text-theme-text-primary">{item.deals}</td>
                  <td className="px-4 py-3 text-right text-theme-text-primary">
                    ${(item.revenue / item.deals / 1000).toFixed(0)}K
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-theme-accent">{item.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-theme-muted border border-theme-border rounded-lg p-4">
      <p className="text-xs font-medium text-theme-text-secondary uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-theme-text-primary mt-2">{value}</p>
    </div>
  );
}
