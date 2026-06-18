export interface JournalEntry {
  id: string;
  date: string;
  account: string;
  description: string;
  debit: string;
  credit: string;
}

export interface FinancialMetricsData {
  totalRevenue: string;
  totalExpenses: string;
  netIncome: string;
  cashBalance: string;
}

export interface IncomeStatementData {
  revenue: string;
  cogs: string;
  grossProfit: string;
  netIncome: string;
}

export interface BalanceSheetItem {
  label: string;
  amount: string;
}

export type AlertType = 'success' | 'error' | 'info';

export interface AlertMessage {
  type: AlertType;
  message: string;
}
