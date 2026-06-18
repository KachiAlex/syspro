'use client';

import React from 'react';

interface BalanceSheetProps {
  assets?: string;
  accountsReceivable?: string;
  totalAssets?: string;
  liabilities?: string;
  equity?: string;
}

export const BalanceSheet: React.FC<BalanceSheetProps> = ({
  assets = '$67,234',
  accountsReceivable = '$45,678',
  totalAssets = '$136,368',
  liabilities = '$35,801',
  equity = '$100,567'
}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Balance Sheet</h3>
      <div className="space-y-3">
        <div className="border-b pb-3">
          <h4 className="font-medium text-gray-900 mb-2">Assets</h4>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Cash</span>
            <span>{assets}</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Accounts Receivable</span>
            <span>{accountsReceivable}</span>
          </div>
          <div className="flex justify-between font-semibold text-sm border-t pt-1">
            <span>Total Assets</span>
            <span>{totalAssets}</span>
          </div>
        </div>
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Liabilities & Equity</h4>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Total Liabilities</span>
            <span>{liabilities}</span>
          </div>
          <div className="flex justify-between font-semibold text-sm border-t pt-1">
            <span>Owner's Equity</span>
            <span>{equity}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
