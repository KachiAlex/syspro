'use client';

import React from 'react';
import { TrainingSession } from '../types';

interface TrainingProps {
  sessions?: TrainingSession[];
  onScheduleTraining: () => void;
}

export const TrainingSection: React.FC<TrainingProps> = ({
  sessions = [],
  onScheduleTraining,
}) => {
  const getStatusStyles = (status: TrainingSession['status']) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-800';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800';
      case 'Upcoming':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-theme-muted text-theme-text-primary';
    }
  };

  return (
    <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-theme-text-primary">Training & Development</h3>
        <button 
          onClick={onScheduleTraining}
          className="text-sm text-theme-accent hover:text-blue-800"
        >
          Schedule Training
        </button>
      </div>
      <div className="space-y-3">
        {sessions.map((t, i) => (
          <div key={i} className="flex items-center justify-between p-4 bg-theme-muted rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h4 className="font-medium text-theme-text-primary">{t.title}</h4>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusStyles(t.status)}`}>
                  {t.status}
                </span>
              </div>
              <p className="text-sm text-theme-text-secondary">{t.participants} participants • Instructor: {t.instructor}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
