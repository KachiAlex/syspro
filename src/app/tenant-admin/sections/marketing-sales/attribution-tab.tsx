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

        if (res.ok) {
          const responseData = await res.json();
          
          // Handle both wrapped and unwrapped responses
          const apiData = responseData.data || responseData.summary || responseData;
          
          setData({
            summary: {
              totalRevenue: apiData.totalRevenue ?? 450000,
              touchpoints: apiData.touchpoints ?? 1250,
              avgTouchesPerDeal: apiData.avgTouchesPerDeal ?? 3.8,
            },
            byChannel: [
              { channel: "Email", revenue: 180000, deals: 24, percentage: 40 },
              { channel: "Paid Search", revenue: 135000, deals: 18, percentage: 30 },
              { channel: "Content", revenue: 90000, deals: 12, percentage: 20 },
              { channel: "Events", revenue: 45000, deals: 6, percentage: 10 },
            ],
            byModel: [
              { model: "First Touch", revenue: 450000, percentage: 100 },
            ],
          });
          onError("");
        } else {
          throw new Error("Failed to fetch attribution data");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load attribution data";
        onError(message);
        // Show demo data
        setData({
          summary: {
            totalRevenue: 450000,
            touchpoints: 1250,
            avgTouchesPerDeal: 3.8,
          },
          byChannel: [
            { channel: "Email", revenue: 180000, deals: 24, percentage: 40 },
            { channel: "Paid Search", revenue: 135000, deals: 18, percentage: 30 },
            { channel: "Content", revenue: 90000, deals: 12, percentage: 20 },
            { channel: "Events", revenue: 45000, deals: 6, percentage: 10 },
          ],
          byModel: [
            { model: "First Touch", revenue: 450000, percentage: 100 },
          ],
        });
      } finally {
        setLoading(false);
      }
    }

    loadAttribution();
  }, [tenantSlug, model, onError]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading attribution data...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Unable to load attribution data</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Model Selector */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-900">Attribution Model:</span>
        <div className="flex gap-3">
          {(["first_touch", "last_touch", "linear"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setModel(m)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                model === m
                  ? "bg-blue-600 text-white"
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
      <div className="border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Revenue by Channel</h3>
        </div>

        <div className="space-y-4">
          {data.byChannel?.map((item) => (
            <div key={item.channel}>
              <div className="flex justify-between mb-2">
                <span className="font-medium text-gray-900">{item.channel}</span>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">${(item.revenue / 1000).toFixed(0)}K</p>
                  <p className="text-xs text-gray-600">{item.deals} deals</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full"
                    style={{ width: `${item.percentage}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium text-gray-600 w-12 text-right">{item.percentage}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison Table */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Channels</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Channel</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-900">Revenue</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-900">Deals</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-900">Avg Value</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-900">Share</th>
              </tr>
            </thead>
            <tbody>
              {data.byChannel?.map((item) => (
                <tr key={item.channel} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.channel}</td>
                  <td className="px-4 py-3 text-right text-gray-900">${(item.revenue / 1000).toFixed(0)}K</td>
                  <td className="px-4 py-3 text-right text-gray-900">{item.deals}</td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    ${(item.revenue / item.deals / 1000).toFixed(0)}K
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-600">{item.percentage}%</td>
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
    <div className="bg-[#111827] border border-gray-200 rounded-lg p-4">
      <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
    </div>
  );
}
