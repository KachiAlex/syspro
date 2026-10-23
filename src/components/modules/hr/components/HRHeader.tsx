'use client';

import React from 'react';

interface HRHeaderProps {
  title?: string;
  subtitle?: string;
}

export const HRHeader: React.FC<HRHeaderProps> = ({ 
  title = 'Human Resources', 
  subtitle = 'Manage employee records, payroll, benefits, and HR analytics' 
}) => {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-theme-text-primary mb-2">{title}</h2>
      <p className="text-theme-text-secondary">{subtitle}</p>
    </div>
  );
};
