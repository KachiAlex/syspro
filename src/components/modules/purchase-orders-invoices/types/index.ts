export interface PurchaseOrder {
  id: string;
  vendor: string;
  orderDate: string;
  deliveryDate: string;
  totalAmount: string;
  status: 'Draft' | 'Pending' | 'Confirmed' | 'Delivered' | 'Cancelled';
}

export interface Invoice {
  id: string;
  poNumber: string;
  vendor: string;
  invoiceDate: string;
  amount: string;
  status: 'Draft' | 'Received' | 'Approved' | 'Paid' | 'Rejected';
}

export interface LineItem {
  itemNumber: number;
  description: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}

export interface POStats {
  totalPOs: number;
  pendingDelivery: number;
  totalValue: string;
}

export interface InvoiceStats {
  totalInvoices: number;
  awaitingApproval: number;
  totalAmount: string;
}

export type AlertType = 'success' | 'error' | 'info';

export interface AlertMessage {
  type: AlertType;
  message: string;
}
