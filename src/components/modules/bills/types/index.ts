export interface Bill {
  id: string;
  vendor: string;
  amount: string;
  dueDate: string;
  status: 'Draft' | 'Unpaid' | 'Partially Paid' | 'Paid' | 'Overdue';
}

export interface BillStats {
  totalBills: number;
  outstanding: string;
  overdue: string;
  dueThisWeek: string;
}

export interface AgingBucket {
  label: string;
  amount: string;
  bgColor: string;
  textColor: string;
  range: string;
}

export type AlertType = 'success' | 'error' | 'info';

export interface AlertMessage {
  type: AlertType;
  message: string;
}
