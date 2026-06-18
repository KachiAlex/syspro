'use client';

import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import { AlertMessage } from '../types';

interface AlertProps {
  alert: AlertMessage | null;
  onClose: () => void;
}

export const Alert: React.FC<AlertProps> = ({ alert, onClose }) => {
  React.useEffect(() => {
    if (alert) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert, onClose]);

  if (!alert) return null;

  const getBgColor = (type: AlertMessage['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getTextColor = (type: AlertMessage['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-800';
      case 'error':
        return 'text-red-800';
      case 'info':
        return 'text-blue-800';
    }
  };

  const getIcon = (type: AlertMessage['type']) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'info':
        return 'ℹ';
    }
  };

  return (
    <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg border ${getBgColor(alert.type)} flex items-center justify-between gap-4 shadow-lg`}>
      <div className={`flex items-center gap-2 ${getTextColor(alert.type)}`}>
        <span className="font-bold text-lg">{getIcon(alert.type)}</span>
        <p className="text-sm font-medium">{alert.message}</p>
      </div>
      <button onClick={onClose} className={`${getTextColor(alert.type)}`}>
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
