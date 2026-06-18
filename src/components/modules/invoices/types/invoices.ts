export interface Invoice {
  id: string;
  billId: string;
  customer: string;
  amount: string;
  status: 'Draft' | 'Sent' | 'Viewed' | 'Overdue' | 'Paid';
  issueDate: string;
  dueDate: string;
}

export interface InvoiceLineItem {
  itemId: string;
  description: string;
  quantity: number;
  unitPrice: string;
  total: string;
}

export type AlertType = 'success' | 'error' | 'info';

export interface AlertMessage {
  type: AlertType;
  message: string;
}
