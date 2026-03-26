export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendor: string;
  date: string;
  amount: string;
  status: 'Draft' | 'Pending' | 'Approved' | 'Received' | 'Closed';
  items: number;
}

export interface POLineItem {
  itemId: string;
  description: string;
  quantity: number;
  unitPrice: string;
  amount: string;
}

export interface POStats {
  totalPOs: number;
  pending: number;
  totalValue: string;
  onOrder: string;
}

export type AlertType = 'success' | 'error' | 'info';

export interface AlertMessage {
  type: AlertType;
  message: string;
}
