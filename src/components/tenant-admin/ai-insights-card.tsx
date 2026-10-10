"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, AlertTriangle, AlertCircle, Info, RefreshCw } from "lucide-react";

interface Insight {
  category: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  recommendedAction: string;
}

const SEVERITY_STYLE: Record<string, { icon: React.ReactNode; badge: string }> = {
  high: { icon: <AlertTriangle className="w-4 h-4 text-red-400" />, badge: "bg-red-500/15 text-red-400 border-red-500/30" },
  medium: { icon: <AlertCircle className="w-4 h-4 text-amber-400" />, badge: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  low: { icon: <Info className="w-4 h-4 text-blue-400" />, badge: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
};

export function AiInsightsCard() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/insights");
      if (!res.ok) throw new Error("Failed to load insights");
      const data = await res.json();
      setInsights(data.insights ?? []);
    } catch (e: any) {
      setError(e?.message || "Failed to load insights");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="gradient-card bg-theme-surface rounded-xl border border-theme-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-theme-text-primary flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-theme-accent" />
          AI Insights
        </h3>
        <button
          onClick={load}
          disabled={loading}
          className="p-1.5 text-theme-text-tertiary hover:text-theme-accent rounded-lg transition-colors disabled:opacity-50"
          title="Refresh insights"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && insights.length === 0 ? (
        <p className="text-sm text-theme-text-tertiary">Scanning for anomalies…</p>
      ) : error ? (
        <p className="text-sm text-theme-text-tertiary">{error}</p>
      ) : insights.length === 0 ? (
        <p className="text-sm text-theme-text-tertiary">No anomalies detected right now.</p>
      ) : (
        <ul className="space-y-3">
          {insights.slice(0, 5).map((insight, i) => {
            const style = SEVERITY_STYLE[insight.severity] ?? SEVERITY_STYLE.low;
            return (
              <li key={i} className="flex gap-3">
                <div className="mt-0.5 flex-shrink-0">{style.icon}</div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-theme-text-primary">{insight.title}</p>
                    <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${style.badge}`}>
                      {insight.severity}
                    </span>
                  </div>
                  <p className="text-xs text-theme-text-secondary mt-0.5">{insight.description}</p>
                  <p className="text-xs text-theme-accent mt-1">→ {insight.recommendedAction}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
