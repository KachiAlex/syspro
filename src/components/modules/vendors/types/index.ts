export interface Vendor {
  name: string;
  category: string;
  status: 'Active' | 'Inactive';
  rating: number;
  spend: string;
}

export interface VendorPerformance {
  level: 'Excellent' | 'Good' | 'Average' | 'Poor';
  count: number;
  pct: number;
  color: string;
}

export interface VendorSpend {
  name: string;
  spend: string;
  pct: number;
}

export type AlertType = 'success' | 'error' | 'info';

export interface AlertMessage {
  type: AlertType;
  message: string;
}
