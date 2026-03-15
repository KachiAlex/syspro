'use client';

import React from 'react';
import { ProcurementMetrics } from '../types';

interface MetricsGridProps {
  metrics?: ProcurementMetrics;
}

const DEFAULT_METRICS: ProcurementMetrics = {
  avgApprovalTime: '4.2 days',
  onTimeDelivery: '87%',
  avgOrderValue: '$2,450',
  budgetCompliance: '94%'
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
        <div key={i} className="text-center p-4 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
          <p className="text-sm text-gray-600">{metric.label}</p>
        </div>
      ))}
    </div>
  );
};
