"use client";

import React from "react";

function SkeletonCard() {
  return (
    <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-3">
          <div className="h-3 w-20 bg-[rgba(255,255,255,0.07)] rounded" />
          <div className="h-7 w-28 bg-[rgba(255,255,255,0.07)] rounded" />
          <div className="h-3 w-16 bg-[rgba(255,255,255,0.07)] rounded" />
        </div>
        <div className="w-12 h-12 rounded-lg bg-[rgba(255,255,255,0.07)]" />
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-4 animate-pulse">
      <div className="h-3 w-32 bg-[rgba(255,255,255,0.07)] rounded" />
      <div className="flex-1 h-3 bg-[rgba(255,255,255,0.07)] rounded" />
      <div className="h-3 w-20 bg-[rgba(255,255,255,0.07)] rounded" />
      <div className="h-3 w-16 bg-[rgba(255,255,255,0.07)] rounded" />
    </div>
  );
}

interface DashboardSkeletonProps {
  cards?: number;
  rows?: number;
  showTable?: boolean;
}

export function DashboardSkeleton({
  cards = 4,
  rows = 5,
  showTable = true,
}: DashboardSkeletonProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: cards }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      {showTable && (
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
          <div className="h-5 w-32 bg-[rgba(255,255,255,0.07)] rounded mb-4 animate-pulse" />
          <div className="divide-y divide-[rgba(255,255,255,0.07)]">
            {Array.from({ length: rows }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
