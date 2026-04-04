import { apiClient } from '@/lib/api-client';

export interface AttendanceRecord {
  employeeId: string;
  employeeName: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: 'present' | 'absent' | 'late' | 'half_day';
  notes?: string;
}

export interface LeaveRequest {
  employeeId: string;
  employeeName: string;
  leaveType: 'annual' | 'sick' | 'personal' | 'maternity';
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface HRReport {
  id: string;
  title: string;
  type: 'workforce' | 'payroll' | 'attendance' | 'performance' | 'compliance';
  dateRange: { start: string; end: string };
  generatedBy: string;
  generatedAt: string;
  status: 'generating' | 'ready' | 'failed';
  fileUrl?: string;
}

export class HRService {
  // Attendance Management
  static async markAttendance(tenantSlug: string, records: AttendanceRecord[]): Promise<void> {
    try {
      await apiClient.post('/hr/attendance', {
        tenantSlug,
        records
      });
    } catch (error) {
      console.error('Failed to mark attendance:', error);
      throw new Error('Failed to mark attendance. Please try again.');
    }
  }

  static async getAttendanceRecords(tenantSlug: string, filters?: {
    date?: string;
    employeeId?: string;
    status?: string;
  }): Promise<AttendanceRecord[]> {
    try {
      const params = new URLSearchParams();
      params.append('tenantSlug', tenantSlug);
      
      if (filters?.date) params.append('date', filters.date);
      if (filters?.employeeId) params.append('employeeId', filters.employeeId);
      if (filters?.status) params.append('status', filters.status);

      const response = await apiClient.get(`/hr/attendance?${params.toString()}`);
      return response.data.records || [];
    } catch (error) {
      console.error('Failed to fetch attendance records:', error);
      return [];
    }
  }

  static async getAttendanceStats(tenantSlug: string, date: string): Promise<{
    present: number;
    absent: number;
    late: number;
    halfDay: number;
    total: number;
  }> {
    try {
      const response = await apiClient.get(`/hr/attendance/stats?tenantSlug=${tenantSlug}&date=${date}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch attendance stats:', error);
      return {
        present: 0,
        absent: 0,
        late: 0,
        halfDay: 0,
        total: 0
      };
    }
  }

  // Leave Management
  static async submitLeaveRequest(tenantSlug: string, request: LeaveRequest): Promise<LeaveRequest> {
    try {
      const response = await apiClient.post('/hr/leave', {
        ...request,
        tenantSlug
      });
      return response.data;
    } catch (error) {
      console.error('Failed to submit leave request:', error);
      throw new Error('Failed to submit leave request. Please try again.');
    }
  }

  static async getLeaveRequests(tenantSlug: string, filters?: {
    employeeId?: string;
    status?: string;
    leaveType?: string;
  }): Promise<LeaveRequest[]> {
    try {
      const params = new URLSearchParams();
      params.append('tenantSlug', tenantSlug);
      
      if (filters?.employeeId) params.append('employeeId', filters.employeeId);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.leaveType) params.append('leaveType', filters.leaveType);

      const response = await apiClient.get(`/hr/leave?${params.toString()}`);
      return response.data.requests || [];
    } catch (error) {
      console.error('Failed to fetch leave requests:', error);
      return [];
    }
  }

  static async updateLeaveStatus(tenantSlug: string, requestId: string, status: 'approved' | 'rejected'): Promise<void> {
    try {
      await apiClient.patch(`/hr/leave/${requestId}`, {
        tenantSlug,
        status
      });
    } catch (error) {
      console.error('Failed to update leave status:', error);
      throw new Error('Failed to update leave status. Please try again.');
    }
  }

  static async getLeaveBalance(tenantSlug: string, employeeId: string): Promise<{
    annual: { used: number; total: number };
    sick: { used: number; total: number };
    personal: { used: number; total: number };
    maternity: { used: number; total: number };
  }> {
    try {
      const response = await apiClient.get(`/hr/leave/balance?tenantSlug=${tenantSlug}&employeeId=${employeeId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch leave balance:', error);
      return {
        annual: { used: 0, total: 20 },
        sick: { used: 0, total: 10 },
        personal: { used: 0, total: 5 },
        maternity: { used: 0, total: 90 }
      };
    }
  }

  // Report Management
  static async generateReport(tenantSlug: string, reportData: {
    reportType: string;
    startDate: string;
    endDate: string;
    includeCharts: boolean;
    format: string;
  }): Promise<HRReport> {
    try {
      const response = await apiClient.post('/hr/reports', {
        ...reportData,
        tenantSlug
      });
      return response.data;
    } catch (error) {
      console.error('Failed to generate report:', error);
      throw new Error('Failed to generate report. Please try again.');
    }
  }

  static async getReports(tenantSlug: string): Promise<HRReport[]> {
    try {
      const response = await apiClient.get(`/hr/reports?tenantSlug=${tenantSlug}`);
      return response.data.reports || [];
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      return [];
    }
  }

  static async downloadReport(tenantSlug: string, reportId: string): Promise<string> {
    try {
      const response = await apiClient.get(`/hr/reports/${reportId}/download?tenantSlug=${tenantSlug}`);
      return response.data.fileUrl;
    } catch (error) {
      console.error('Failed to download report:', error);
      throw new Error('Failed to download report. Please try again.');
    }
  }

  static async deleteReport(tenantSlug: string, reportId: string): Promise<void> {
    try {
      await apiClient.delete(`/hr/reports/${reportId}?tenantSlug=${tenantSlug}`);
    } catch (error) {
      console.error('Failed to delete report:', error);
      throw new Error('Failed to delete report. Please try again.');
    }
  }

  // Employee Management (additional methods for HR operations)
  static async getEmployees(tenantSlug: string): Promise<Array<{
    id: string;
    name: string;
    email: string;
    department: string;
    position: string;
    status: string;
    salary: number;
    startDate: string;
  }>> {
    try {
      const response = await apiClient.get(`/hr/employees?tenantSlug=${tenantSlug}`);
      return response.data.employees || [];
    } catch (error) {
      console.error('Failed to fetch employees:', error);
      return [];
    }
  }

  static async getDepartments(tenantSlug: string): Promise<string[]> {
    try {
      const response = await apiClient.get(`/hr/departments?tenantSlug=${tenantSlug}`);
      return response.data.departments || [];
    } catch (error) {
      console.error('Failed to fetch departments:', error);
      return ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'];
    }
  }

  // Payroll Management
  static async runPayroll(tenantSlug: string, payrollData: {
    payrollMonth: string;
    payDate: string;
    includeBonuses: boolean;
    processDeductions: boolean;
  }): Promise<{
    id: string;
    period: string;
    totalAmount: number;
    employeeCount: number;
    status: string;
  }> {
    try {
      const response = await apiClient.post('/hr/payroll/run', {
        ...payrollData,
        tenantSlug
      });
      return response.data;
    } catch (error) {
      console.error('Failed to run payroll:', error);
      throw new Error('Failed to run payroll. Please try again.');
    }
  }

  static async getPayrollHistory(tenantSlug: string): Promise<Array<{
    id: string;
    period: string;
    totalAmount: number;
    employeeCount: number;
    status: string;
    processedDate: string;
  }>> {
    try {
      const response = await apiClient.get(`/hr/payroll/history?tenantSlug=${tenantSlug}`);
      return response.data.history || [];
    } catch (error) {
      console.error('Failed to fetch payroll history:', error);
      return [];
    }
  }

  // Training Management
  static async createTrainingSession(tenantSlug: string, trainingData: {
    title: string;
    description: string;
    instructor: string;
    startDate: string;
    endDate: string;
    capacity: number;
  }): Promise<{
    id: string;
    title: string;
    status: string;
    enrolled: number;
  }> {
    try {
      const response = await apiClient.post('/hr/training', {
        ...trainingData,
        tenantSlug
      });
      return response.data;
    } catch (error) {
      console.error('Failed to create training session:', error);
      throw new Error('Failed to create training session. Please try again.');
    }
  }

  static async getTrainingSessions(tenantSlug: string): Promise<Array<{
    id: string;
    title: string;
    description: string;
    instructor: string;
    startDate: string;
    endDate: string;
    capacity: number;
    enrolled: number;
    status: string;
  }>> {
    try {
      const response = await apiClient.get(`/hr/training?tenantSlug=${tenantSlug}`);
      return response.data.sessions || [];
    } catch (error) {
      console.error('Failed to fetch training sessions:', error);
      return [];
    }
  }
}
