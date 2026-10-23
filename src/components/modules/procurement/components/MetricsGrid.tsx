'use client';

import React from 'react';
import { ProcurementMetrics } from '../types';

interface MetricsGridProps {
  metrics?: ProcurementMetrics;
}

const DEFAULT_METRICS: ProcurementMetrics = {
  avgApprovalTime: '—',
  onTimeDelivery: '—',
  avgOrderValue: '—',
  budgetCompliance: '—'
};

export const MetricsGrid: React.FC<MetricsGridProps> = ({
  metrics = DEFAULT_METRICS
}) => {
  const metricsList = [
    { label: 'Avg. Approval Time', value: metrics.avgApprovalTime },
    { label: 'On-Time Delivery', value: metrics.onTimeDelivery },
    { label: 'Avg. Order Value', value: metrics.avgOrderValue },
    { label: 'Budget Compliance', value: metrics.budgetCompliance }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {metricsList.map((metric, i) => (
        <div key={i} className="text-center p-4 bg-theme-muted rounded-lg">
          <p className="text-2xl font-bold text-theme-text-primary">{metric.value}</p>
          <p className="text-sm text-theme-text-secondary">{metric.label}</p>
        </div>
      ))}
    </div>
  );
};
