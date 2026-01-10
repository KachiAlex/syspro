'use client';

import React from 'react';
import clsx from 'clsx';
import { DashboardStat } from '../../lib/types/shared';

interface StatsGridProps {
  stats?: DashboardStat[];
  isLoading?: boolean;
}

const trendLabels: Record<DashboardStat['trend'], string> = {
  up: 'text-green-600',
  down: 'text-red-600',
  flat: 'text-gray-500',
};

const trendSymbol: Record<DashboardStat['trend'], string> = {
  up: '▲',
  down: '▼',
  flat: '■',
};

export function StatsGrid({ stats = [], isLoading }: StatsGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="bg-white shadow rounded-lg p-5 animate-pulse">
            <div className="h-4 w-20 bg-gray-200 rounded mb-3" />
            <div className="h-6 w-32 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats.length) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
      {stats.map((stat) => (
        <div key={stat.id} className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">
                  {Intl.NumberFormat(undefined, {
                    style: stat.id === 'revenue' ? 'currency' : 'decimal',
                    currency: 'USD',
                    maximumFractionDigits: 2,
                  }).format(stat.value)}
                </p>
              </div>
              <div className="text-right">
                <span
                  className={clsx(
                    'inline-flex items-center text-xs font-semibold',
                    trendLabels[stat.trend],
                  )}
                >
                  {trendSymbol[stat.trend]} {stat.change}%
                </span>
                <p className="text-xs text-gray-400 mt-1">vs last {stat.period}</p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
