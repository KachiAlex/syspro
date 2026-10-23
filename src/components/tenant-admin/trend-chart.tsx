"use client";

import React from "react";

/**
 * Dual-series SVG area+line chart for revenue vs expenses.
 * Pure SVG — no chart lib dependency. Expects {labels, revenue[], expenses[]}
 * as returned by /api/finance/dashboard snapshot.trend.
 */
export function TrendChart({
  labels,
  revenue,
  expenses,
  height = 180,
}: {
  labels: string[];
  revenue: number[];
  expenses: number[];
  height?: number;
}) {
  const W = 640;
  const H = height;
  const PAD = { t: 12, r: 12, b: 24, l: 44 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const n = Math.max(revenue.length, expenses.length);
  if (n < 2) {
    return (
      <div className="flex items-center justify-center h-[180px] text-sm text-theme-text-tertiary">
        Not enough data to chart yet — trends appear once transactions accumulate.
      </div>
    );
  }

  const rev = revenue.slice(-n);
  const exp = expenses.slice(-n);
  const lab = labels.slice(-n);
  const max = Math.max(1e-9, ...rev, ...exp) * 1.15;

  const x = (i: number) => PAD.l + (i / (n - 1)) * innerW;
  const y = (v: number) => PAD.t + innerH - (v / max) * innerH;

  const line = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = (arr: number[]) =>
    `${line(arr)} L${x(n - 1).toFixed(1)},${(PAD.t + innerH).toFixed(1)} L${x(0).toFixed(1)},${(PAD.t + innerH).toFixed(1)} Z`;

  const fmt = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : v.toFixed(0);

  const gridY = [0.25, 0.5, 0.75, 1];
  const labelEvery = Math.ceil(n / 6);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Revenue vs expenses trend">
        <defs>
          <linearGradient id="tcRev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="tcExp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {gridY.map((g) => (
          <g key={g}>
            <line
              x1={PAD.l} x2={W - PAD.r}
              y1={PAD.t + innerH - g * innerH} y2={PAD.t + innerH - g * innerH}
              stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 4"
            />
            <text
              x={PAD.l - 6} y={PAD.t + innerH - g * innerH + 4}
              textAnchor="end" fontSize="10" fill="currentColor" fillOpacity="0.45"
            >
              {fmt(max * g)}
            </text>
          </g>
        ))}

        <path d={area(exp)} fill="url(#tcExp)" />
        <path d={area(rev)} fill="url(#tcRev)" />
        <path d={line(exp)} fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinejoin="round" />
        <path d={line(rev)} fill="none" stroke="#818cf8" strokeWidth="2.5" strokeLinejoin="round" />

        {lab.map((l, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text
              key={i} x={x(i)} y={H - 6} textAnchor="middle"
              fontSize="10" fill="currentColor" fillOpacity="0.45"
            >
              {String(l).slice(5)}
            </text>
          ) : null
        )}
      </svg>
      <div className="flex items-center gap-5 mt-2 px-1">
        <span className="flex items-center gap-1.5 text-xs text-theme-text-secondary">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" /> Revenue
        </span>
        <span className="flex items-center gap-1.5 text-xs text-theme-text-secondary">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400" /> Expenses
        </span>
      </div>
    </div>
  );
}
