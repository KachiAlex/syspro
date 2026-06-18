'use client';

import React from 'react';
import { AgingBucket } from '../types';

interface AgingAnalysisProps {
  agingBuckets?: AgingBucket[];
}

const DEFAULT_AGING_BUCKETS: AgingBucket[] = [
  { label: 'Over 90 Days', amount: '$12,450', bgColor: 'bg-red-50', textColor: 'text-red-600', range: 'Over 90 Days' },
  { label: '61-90 Days', amount: '$23,567', bgColor: 'bg-orange-50', textColor: 'text-orange-600', range: '61-90 Days' },
  { label: '31-60 Days', amount: '$34,789', bgColor: 'bg-yellow-50', textColor: 'text-yellow-600', range: '31-60 Days' },
  { label: '0-30 Days', amount: '$45,678', bgColor: 'bg-green-50', textColor: 'text-green-600', range: '0-30 Days' }
];

export const AgingAnalysis: React.FC<AgingAnalysisProps> = ({
  agingBuckets = DEFAULT_AGING_BUCKETS
}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Accounts Payable Aging</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {agingBuckets.map((bucket, i) => (
          <div key={i} className={`text-center p-4 ${bucket.bgColor} rounded-lg`}>
            <p className={`text-2xl font-bold ${bucket.textColor}`}>{bucket.amount}</p>
            <p className="text-sm text-gray-600">{bucket.range}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
