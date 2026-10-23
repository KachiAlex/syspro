'use client';

import React from 'react';
import { AgingBucket } from '../types';

interface AgingAnalysisProps {
  agingBuckets?: AgingBucket[];
}

export const AgingAnalysis: React.FC<AgingAnalysisProps> = ({
  agingBuckets = []
}) => {
  return (
    <div className="bg-theme-surface rounded-lg border border-theme-border p-6 mb-8">
      <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Accounts Payable Aging</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {agingBuckets.map((bucket, i) => (
          <div key={i} className={`text-center p-4 ${bucket.bgColor} rounded-lg`}>
            <p className={`text-2xl font-bold ${bucket.textColor}`}>{bucket.amount}</p>
            <p className="text-sm text-theme-text-secondary">{bucket.range}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
