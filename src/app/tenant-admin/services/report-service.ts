import { apiClient } from '@/lib/api-client';
import { MockReportService, mockReportTemplates } from './mock-report-service';

export interface Report {
  id: string;
  title: string;
  type: string;
  module: 'financial' | 'sales' | 'hr';
  dateRange: { start: string; end: string };
  generatedBy: string;
  generatedAt: string;
  status: 'generating' | 'ready' | 'failed';
  fileUrl?: string;
  format: 'pdf' | 'excel' | 'csv';
  size?: string;
  downloadCount?: number;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  module: 'financial' | 'sales' | 'hr';
  type: string;
  defaultFormat: 'pdf' | 'excel' | 'csv';
  filters: Array<{
    key: string;
    label: string;
    type: 'select' | 'date' | 'text' | 'number';
    options?: string[];
    required?: boolean;
  }>;
}

export interface ScheduledReport {
  id: string;
  templateId: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  recipients: string[];
  nextRun: string;
  lastRun?: string;
  isActive: boolean;
}

export interface ReportGenerationParams {
  module: 'financial' | 'sales' | 'hr';
  reportType: string;
  dateRange: { start: string; end: string };
  format: 'pdf' | 'excel' | 'csv';
  filters?: Record<string, any>;
  includeCharts?: boolean;
  tenantSlug: string;
}

// Use mock service for development, switch to real API when backend is ready
const useMockService = process.env.NODE_ENV === 'development' || !apiClient;

export class ReportService {
  // Generate a new report
  static async generateReport(params: ReportGenerationParams): Promise<Report> {
    if (useMockService) {
      return MockReportService.generateReport(params);
    }
    
    try {
      const response = await apiClient.post('/reports/generate', params);
      return response.data;
    } catch (error) {
      console.error('Failed to generate report:', error);
      throw new Error('Failed to generate report. Please try again.');
    }
  }

  // Get all reports for a tenant
  static async getReports(tenantSlug: string, module?: string): Promise<Report[]> {
    if (useMockService) {
      return MockReportService.getReports(tenantSlug, module);
    }
    
    try {
      const params = new URLSearchParams({ tenantSlug });
      if (module) params.append('module', module);
      
      const response = await apiClient.get(`/reports?${params.toString()}`);
      return response.data.reports || [];
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      return [];
    }
  }

  // Download a report
  static async downloadReport(reportId: string, tenantSlug: string): Promise<string> {
    if (useMockService) {
      return MockReportService.downloadReport(reportId, tenantSlug);
    }
    
    try {
      const response = await apiClient.get(`/reports/${reportId}/download?tenantSlug=${tenantSlug}`);
      return response.data.fileUrl;
    } catch (error) {
      console.error('Failed to download report:', error);
      throw new Error('Failed to download report. Please try again.');
    }
  }

  // Delete a report
  static async deleteReport(reportId: string, tenantSlug: string): Promise<void> {
    if (useMockService) {
      return MockReportService.deleteReport(reportId, tenantSlug);
    }
    
    try {
      await apiClient.delete(`/reports/${reportId}?tenantSlug=${tenantSlug}`);
    } catch (error) {
      console.error('Failed to delete report:', error);
      throw new Error('Failed to delete report. Please try again.');
    }
  }

  // Get report templates
  static async getReportTemplates(module?: string): Promise<ReportTemplate[]> {
    if (useMockService) {
      return MockReportService.getReportTemplates(module);
    }
    
    try {
      const params = module ? `?module=${module}` : '';
      const response = await apiClient.get(`/reports/templates${params}`);
      return response.data.templates || [];
    } catch (error) {
      console.error('Failed to fetch report templates:', error);
      return [];
    }
  }

  // Schedule a report
  static async scheduleReport(params: {
    templateId: string;
    name: string;
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    recipients: string[];
    filters?: Record<string, any>;
    tenantSlug: string;
  }): Promise<ScheduledReport> {
    try {
      const response = await apiClient.post('/reports/schedule', params);
      return response.data;
    } catch (error) {
      console.error('Failed to schedule report:', error);
      throw new Error('Failed to schedule report. Please try again.');
    }
  }

  // Get scheduled reports
  static async getScheduledReports(tenantSlug: string): Promise<ScheduledReport[]> {
    try {
      const response = await apiClient.get(`/reports/scheduled?tenantSlug=${tenantSlug}`);
      return response.data.scheduledReports || [];
    } catch (error) {
      console.error('Failed to fetch scheduled reports:', error);
      return [];
    }
  }

  // Update scheduled report
  static async updateScheduledReport(
    reportId: string, 
    updates: Partial<ScheduledReport>,
    tenantSlug: string
  ): Promise<ScheduledReport> {
    try {
      const response = await apiClient.patch(`/reports/scheduled/${reportId}`, {
        ...updates,
        tenantSlug
      });
      return response.data;
    } catch (error) {
      console.error('Failed to update scheduled report:', error);
      throw new Error('Failed to update scheduled report. Please try again.');
    }
  }

  // Delete scheduled report
  static async deleteScheduledReport(reportId: string, tenantSlug: string): Promise<void> {
    try {
      await apiClient.delete(`/reports/scheduled/${reportId}?tenantSlug=${tenantSlug}`);
    } catch (error) {
      console.error('Failed to delete scheduled report:', error);
      throw new Error('Failed to delete scheduled report. Please try again.');
    }
  }

  // Share report with secure link
  static async shareReport(reportId: string, params: {
    expiresAt?: string;
    password?: string;
    tenantSlug: string;
  }): Promise<{ shareLink: string; expiresAt: string }> {
    try {
      const response = await apiClient.post(`/reports/${reportId}/share`, params);
      return response.data;
    } catch (error) {
      console.error('Failed to share report:', error);
      throw new Error('Failed to share report. Please try again.');
    }
  }

  // Get report analytics
  static async getReportAnalytics(tenantSlug: string): Promise<{
    totalReports: number;
    reportsByModule: Record<string, number>;
    reportsByType: Record<string, number>;
    recentActivity: Array<{
      reportId: string;
      action: string;
      timestamp: string;
      user: string;
    }>;
  }> {
    if (useMockService) {
      return MockReportService.getReportAnalytics(tenantSlug);
    }
    
    try {
      const response = await apiClient.get(`/reports/analytics?tenantSlug=${tenantSlug}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch report analytics:', error);
      return {
        totalReports: 0,
        reportsByModule: {},
        reportsByType: {},
        recentActivity: []
      };
    }
  }
}
