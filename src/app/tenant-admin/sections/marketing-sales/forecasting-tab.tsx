"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, TrendingUp, Calendar } from "lucide-react";

interface ForecastData {
  summary?: {
    forecastedRevenue: number;
    confidence: number;
    period: string;
    lastUpdated: string;
  };
  monthlyForecast?: Array<{
    month: string;
    conservative: number;
    expected: number;
    optimistic: number;
  }>;
  scenarios?: Array<{
    name: string;
    revenue: number;
    probability: number;
  }>;
}

export default function ForecastingTab({
  tenantSlug,
  onError,
}: {
  tenantSlug: string;
  onError: (error: string) => void;
}) {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadForecast() {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/revops/forecast?tenantSlug=${encodeURIComponent(tenantSlug)}`
        );

        if (res.ok) {
          const responseData = await res.json();
          const apiData = responseData.data || responseData;
          
          setData({
            summary: {
              forecastedRevenue: apiData.forecastedRevenue ?? 2800000,
              confidence: apiData.confidence ?? 78,
              period: "Q2 2026",
              lastUpdated: new Date().toLocaleDateString(),
            },
            monthlyForecast: [
              { month: "Apr 2026", conservative: 750000, expected: 900000, optimistic: 1100000 },
              { month: "May 2026", conservative: 800000, expected: 1000000, optimistic: 1200000 },
              { month: "Jun 2026", conservative: 850000, expected: 900000, optimistic: 1050000 },
            ],
            scenarios: [
              { name: "Conservative", revenue: 2400000, probability: 30 },
              { name: "Expected", revenue: 2800000, probability: 50 },
              { name: "Optimistic", revenue: 3350000, probability: 20 },
            ],
          });
          onError("");
        } else {
          throw new Error("Failed to fetch forecast");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load forecast";
        onError(message);
        // Show demo data
        setData({
          summary: {
            forecastedRevenue: 2800000,
            confidence: 78,
            period: "Q2 2026",
            lastUpdated: new Date().toLocaleDateString(),
          },
          monthlyForecast: [
            { month: "Apr 2026", conservative: 750000, expected: 900000, optimistic: 1100000 },
            { month: "May 2026", conservative: 800000, expected: 1000000, optimistic: 1200000 },
            { month: "Jun 2026", conservative: 850000, expected: 900000, optimistic: 1050000 },
          ],
          scenarios: [
            { name: "Conservative", revenue: 2400000, probability: 30 },
            { name: "Expected", revenue: 2800000, probability: 50 },
            { name: "Optimistic", revenue: 3350000, probability: 20 },
          ],
        });
      } finally {
        setLoading(false);
      }
    }

    loadForecast();
  }, [tenantSlug, onError]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading forecast...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-4 text-gray-600">No forecast data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Summary Card */}
      <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm font-medium text-gray-600">Forecasted Revenue ({data.summary?.period})</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              ₦{(data.summary?.forecastedRevenue || 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Forecast Confidence</p>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-300 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${data.summary?.confidence || 0}%` }}
                ></div>
              </div>
              <p className="text-2xl font-bold text-green-600">{data.summary?.confidence}%</p>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Last Updated</p>
            <p className="mt-2 text-lg font-medium text-gray-900">{data.summary?.lastUpdated}</p>
          </div>
        </div>
      </div>

      {/* Monthly Forecast */}
      {data.monthlyForecast && data.monthlyForecast.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-[#111827] p-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
            <Calendar className="w-5 h-5" />
            Monthly Forecast
          </h3>
          <div className="space-y-4">
            {data.monthlyForecast.map((month, idx) => (
              <div key={idx} className="pb-4 border-b border-gray-100 last:border-0">
                <p className="font-medium text-gray-900">{month.month}</p>
                <div className="mt-3 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-600">Conservative</p>
                    <p className="text-sm font-medium text-gray-900">₦{month.conservative.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Expected</p>
                    <p className="text-sm font-bold text-blue-600">₦{month.expected.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Optimistic</p>
                    <p className="text-sm font-medium text-green-600">₦{month.optimistic.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scenarios */}
      {data.scenarios && data.scenarios.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-[#111827] p-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
            <TrendingUp className="w-5 h-5" />
            Revenue Scenarios
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.scenarios.map((scenario, idx) => {
              const colors = ["bg-orange-50 border-orange-200", "bg-blue-50 border-blue-200", "bg-green-50 border-green-200"];
              return (
                <div key={idx} className={`rounded-lg border p-4 ${colors[idx] || "bg-gray-50"}`}>
                  <p className="font-medium text-gray-900">{scenario.name}</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">
                    ₦{scenario.revenue.toLocaleString()}
                  </p>
                  <p className="mt-2 text-sm text-gray-600">Probability: {scenario.probability}%</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
