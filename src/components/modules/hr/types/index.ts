export interface Employee {
  name: string;
  email: string;
  department: string;
  position: string;
  startDate: string;
  status: string;
  performance: string;
  salary: string;
}

export interface HRStats {
  totalEmployees: number;
  openPositions: number;
  monthlyPayroll: string;
  avgPerformance: string;
}

export interface TrainingSession {
  title: string;
  participants: number;
  status: 'Upcoming' | 'In Progress' | 'Completed';
  instructor: string;
}

export interface DepartmentInfo {
  dept: string;
  count: number;
  pct: number;
}

export interface PayrollInfo {
  label: string;
  amount: string;
  bgColor: string;
  textColor: string;
}

export type AlertType = 'success' | 'error' | 'info';

export interface AlertMessage {
  type: AlertType;
  message: string;
}
