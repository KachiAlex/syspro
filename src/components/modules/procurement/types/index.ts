export interface Requisition {
  id: string;
  requester: string;
  department: string;
  items: number;
  value: string;
  status: 'Pending Approval' | 'Approved' | 'Rejected' | 'Ordered';
}

export interface PendingApproval {
  id: string;
  priority: 'High' | 'Medium' | 'Low';
  value: string;
  submitted: string;
}

export interface DepartmentSpend {
  dept: string;
  spend: string;
  pct: number;
}

export interface ProcurementMetrics {
  avgApprovalTime: string;
  onTimeDelivery: string;
  avgOrderValue: string;
  budgetCompliance: string;
}

export type AlertType = 'success' | 'error' | 'info';

export interface AlertMessage {
  type: AlertType;
  message: string;
}
