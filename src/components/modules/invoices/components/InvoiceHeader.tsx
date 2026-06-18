'use client';

import React from 'react';
import { FileText, Clock, DollarSign, AlertCircle } from 'lucide-react';

interface InvoiceHeaderProps {
  totalInvoices: number;
  pendingInvoices?: number;
  totalAmount?: string;
  overdueAmount?: string;
}

export const InvoiceHeader: React.FC<InvoiceHeaderProps> = ({
  totalInvoices,
  pendingInvoices = 8,
  totalAmount = '$456,789',
  overdueAmount = '$23,450'
}) => {
  const stats = [
    { label: 'Total Invoices', value: totalInvoices, icon: FileText, color: 'text-blue-600' },
    { label: 'Pending', value: pendingInvoices, icon: Clock, color: 'text-orange-600' },
    { label: 'Total Amount', value: totalAmount, icon: DollarSign, color: 'text-green-600' },
    { label: 'Overdue', value: overdueAmount, icon: AlertCircle, color: 'text-red-600' }
  ];

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Invoices</h2>
        <p className="text-gray-600">Create, send, and track customer invoices with automated payment tracking</p>
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
