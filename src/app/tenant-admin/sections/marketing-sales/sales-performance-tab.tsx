"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, BarChart3, TrendingUp } from "lucide-react";

interface PerformanceData {
  summary?: {
    totalDeals: number;
    totalRevenue: number;
    winRate: number;
    avgDealSize: number;
  };
  byRep?: Array<{ rep: string; deals: number; revenue: number; quota: number }>;
  bySalesStage?: Array<{ stage: string; count: number; value: number }>;
}

export default function SalesPerformanceTab({
  tenantSlug,
  onError,
}: {
  tenantSlug: string;
  onError: (error: string) => void;
}) {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPerformance() {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/revops/sales-performance?tenantSlug=${encodeURIComponent(tenantSlug)}`
        );

        if (!res.ok) {
          throw new Error("Failed to fetch sales performance");
        }
        const responseData = await res.json();
        const snapshot = responseData.snapshot ?? responseData.data ?? null;
        const targets = Array.isArray(responseData.targets) ? responseData.targets : [];

        const repProductivity = Array.isArray(snapshot?.repProductivity) ? snapshot.repProductivity : [];
        const funnelLeakage = Array.isArray(snapshot?.funnelLeakage) ? snapshot.funnelLeakage : [];

        const totalDeals = repProductivity.reduce((sum: number, r: any) => sum + Number(r.wins ?? 0), 0) || targets.length;

        setData({
          summary: {
            totalDeals,
            totalRevenue: Number(snapshot?.revenueAchieved ?? 0),
            winRate: Number(snapshot?.winRate ?? 0),
            avgDealSize: Number(snapshot?.avgDealSize ?? 0),
          },
          byRep: repProductivity.map((r: any) => ({
            rep: r.repName ?? r.repId ?? "Unknown",
            deals: Number(r.wins ?? 0),
            revenue: Number(r.attainment ?? 0),
            quota: Number(r.attainment ?? 0),
          })),
          bySalesStage: funnelLeakage.map((s: any) => ({
            stage: s.stage ?? "Unknown",
            count: Number(s.entered ?? 0),
            value: Number(s.converted ?? 0),
          })),
        });
        onError("");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load sales performance";
        onError(message);
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    loadPerformance();
  }, [tenantSlug, onError]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-theme-border border-t-blue-600"></div>
        <p className="mt-4 text-theme-text-secondary">Loading sales performance...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-theme-text-tertiary" />
        <p className="mt-4 text-theme-text-secondary">No sales performance data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-theme-border bg-theme-muted p-4">
          <p className="text-sm font-medium text-theme-text-secondary">Total Deals</p>
          <p className="mt-2 text-2xl font-bold text-theme-text-primary">{data.summary?.totalDeals}</p>
        </div>
        <div className="rounded-lg border border-theme-border bg-theme-muted p-4">
          <p className="text-sm font-medium text-theme-text-secondary">Total Revenue</p>
          <p className="mt-2 text-2xl font-bold text-theme-text-primary">
            ₦{(data.summary?.totalRevenue || 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-theme-border bg-theme-muted p-4">
          <p className="text-sm font-medium text-theme-text-secondary">Win Rate</p>
          <p className="mt-2 text-2xl font-bold text-green-600">{data.summary?.winRate}%</p>
        </div>
        <div className="rounded-lg border border-theme-border bg-theme-muted p-4">
          <p className="text-sm font-medium text-theme-text-secondary">Avg Deal Size</p>
          <p className="mt-2 text-2xl font-bold text-theme-text-primary">
            ₦{(data.summary?.avgDealSize || 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* By Rep */}
      {data.byRep && data.byRep.length > 0 && (
        <div className="rounded-lg border border-theme-border bg-theme-muted p-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-theme-text-primary mb-4">
            <BarChart3 className="w-5 h-5" />
            Performance by Sales Rep
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-theme-border">
                  <th className="text-left py-2 px-3 font-medium text-theme-text-primary">Rep</th>
                  <th className="text-right py-2 px-3 font-medium text-theme-text-primary">Deals</th>
                  <th className="text-right py-2 px-3 font-medium text-theme-text-primary">Revenue</th>
                  <th className="text-right py-2 px-3 font-medium text-theme-text-primary">Quota</th>
                  <th className="text-right py-2 px-3 font-medium text-theme-text-primary">% to Quota</th>
                </tr>
              </thead>
              <tbody>
                {data.byRep.map((rep, idx) => {
                  const quotaPercent = ((rep.revenue / rep.quota) * 100).toFixed(0);
                  return (
                    <tr key={idx} className="border-b border-theme-border">
                      <td className="py-3 px-3 text-theme-text-primary">{rep.rep}</td>
                      <td className="py-3 px-3 text-right text-theme-text-secondary">{rep.deals}</td>
                      <td className="py-3 px-3 text-right text-theme-text-primary font-medium">
                        ₦{rep.revenue.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right text-theme-text-secondary">
                        ₦{rep.quota.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className={`font-medium ${Number(quotaPercent) >= 100 ? "text-green-600" : "text-orange-600"}`}>
                          {quotaPercent}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* By Sales Stage */}
      {data.bySalesStage && data.bySalesStage.length > 0 && (
        <div className="rounded-lg border border-theme-border bg-theme-muted p-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-theme-text-primary mb-4">
            <TrendingUp className="w-5 h-5" />
            Pipeline by Sales Stage
          </h3>
          <div className="space-y-3">
            {data.bySalesStage.map((stage, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium text-theme-text-primary">{stage.stage}</p>
                  <p className="text-sm text-theme-text-secondary">{stage.count} deals</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-theme-text-primary">₦{stage.value.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
