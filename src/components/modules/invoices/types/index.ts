export interface Invoice {
  id: string;
  invoiceNumber: string;
  poNumber: string;
  vendor: string;
  amount: string;
  date: string;
  dueDate: string;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Paid' | 'Overdue';
}

export interface InvoiceLineItem {
  itemId: string;
  description: string;
  quantity: number;
  unitPrice: string;
  amount: string;
}

export interface InvoiceStats {
  totalInvoices: number;
  pending: number;
  totalAmount: string;
  overdue: string;
}

export type AlertType = 'success' | 'error' | 'info';

export interface AlertMessage {
  type: AlertType;
  message: string;
}
