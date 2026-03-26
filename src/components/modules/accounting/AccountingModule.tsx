'use client';

import React from 'react';
import {
  FinancialMetrics,
  AccountingQuickActions,
  IncomeStatement,
  BalanceSheet,
  JournalEntriesTable,
  ChartOfAccounts,
  Alert,
  type JournalEntry,
  type AlertMessage
} from './index';

interface AccountingModuleProps {
  tenantSlug: string;
  journalEntries?: JournalEntry[];
}

export const AccountingModule: React.FC<AccountingModuleProps> = ({
  tenantSlug,
  journalEntries = [
    { id: 'JE-2024-001', date: '2024-02-22', account: 'Cash', description: 'Payment from Tech Corp', debit: '$15,000', credit: '' },
    { id: 'JE-2024-002', date: '2024-02-21', account: 'Office Supplies', description: 'Equipment purchase', debit: '$234.75', credit: '' }
  ]
}) => {
  const [alert, setAlert] = React.useState<AlertMessage | null>(null);

  const showAlert = (type: AlertMessage['type'], message: string) => {
    setAlert({ type, message });
  };

  return (
    <div className="p-6">
      <FinancialMetrics
        totalRevenue="$234,567"
        totalExpenses="$145,890"
        netIncome="$88,677"
        cashBalance="$67,234"
      />
      
      <AccountingQuickActions
        onJournalEntry={() => showAlert('info', 'Journal Entry modal')}
        onGenerateReport={() => showAlert('success', 'Income Statement report generated!')}
        onChartOfAccounts={() => showAlert('info', 'Opening Chart of Accounts')}
        onExportData={() => showAlert('success', 'Financial data exported!')}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <IncomeStatement
          revenue="$234,567"
          cogs="-$67,234"
          grossProfit="$167,333"
          netIncome="$88,677"
        />
        <BalanceSheet
          assets="$67,234"
          accountsReceivable="$45,678"
          totalAssets="$136,368"
          liabilities="$35,801"
          equity="$100,567"
        />
      </div>
      
      <JournalEntriesTable
        entries={journalEntries}
        onView={(entry) => showAlert('info', `Viewing ${entry.id}`)}
        onEdit={(entry) => showAlert('info', `Editing ${entry.id}`)}
      />
      
      <ChartOfAccounts />
      
      <Alert alert={alert} onClose={() => setAlert(null)} />
    </div>
  );
};

export default AccountingModule;
