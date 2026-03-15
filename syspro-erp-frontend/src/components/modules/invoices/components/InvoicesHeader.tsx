'use client';

import React from 'react';
import { FileText, Send, DollarSign, AlertCircle } from 'lucide-react';

interface InvoicesHeaderProps {
  totalInvoices: number;
  sentInvoices?: number;
  collectedAmount?: string;
  outstandingAmount?: string;
}

export const InvoicesHeader: React.FC<InvoicesHeaderProps> = ({
  totalInvoices,
  sentInvoices = 45,
  collectedAmount = '$234,567',
  outstandingAmount = '$45,678'
}) => {
  const stats = [
    { label: 'Total Invoices', value: totalInvoices, icon: FileText, color: 'text-blue-600' },
    { label: 'Sent', value: sentInvoices, icon: Send, color: 'text-green-600' },
    { label: 'Collected', value: collectedAmount, icon: DollarSign, color: 'text-emerald-600' },
    { label: 'Outstanding', value: outstandingAmount, icon: AlertCircle, color: 'text-orange-600' }
  ];

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Invoices</h2>
        <p className="text-gray-600">Create, send, and track customer invoices</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{stat.label}</p>
                  <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <Icon className={`w-8 h-8 ${stat.color}`} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
