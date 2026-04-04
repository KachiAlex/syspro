import { apiClient } from '@/lib/api-client';

// Mock data for report templates
export const mockReportTemplates = {
  financial: [
    {
      id: 'income-statement',
      name: 'Income Statement',
      description: 'Revenue, expenses, and profit analysis',
      module: 'financial' as const,
      type: 'income-statement',
      defaultFormat: 'pdf' as const,
      filters: [
        { key: 'accountType', label: 'Account Type', type: 'select' as const, options: ['All', 'Revenue', 'Expenses', 'Cost of Goods Sold'] },
        { key: 'department', label: 'Department', type: 'select' as const, options: ['All', 'Sales', 'Marketing', 'Operations', 'HR'] },
        { key: 'comparison', label: 'Comparison Period', type: 'select' as const, options: ['None', 'Previous Month', 'Previous Quarter', 'Previous Year'] }
      ]
    },
    {
      id: 'balance-sheet',
      name: 'Balance Sheet',
      description: 'Assets, liabilities, and equity summary',
      module: 'financial' as const,
      type: 'balance-sheet',
      defaultFormat: 'pdf' as const,
      filters: [
        { key: 'accountCategory', label: 'Account Category', type: 'select' as const, options: ['All', 'Current Assets', 'Fixed Assets', 'Current Liabilities', 'Long-term Liabilities'] },
        { key: 'showDetails', label: 'Show Account Details', type: 'text' as const }
      ]
    },
    {
      id: 'cash-flow',
      name: 'Cash Flow Statement',
      description: 'Operating, investing, and financing cash flows',
      module: 'financial' as const,
      type: 'cash-flow',
      defaultFormat: 'excel' as const,
      filters: [
        { key: 'flowType', label: 'Flow Type', type: 'select' as const, options: ['All', 'Operating Activities', 'Investing Activities', 'Financing Activities'] },
        { key: 'includeBudget', label: 'Include Budget Comparison', type: 'text' as const }
      ]
    },
    {
      id: 'expense-analysis',
      name: 'Expense Analysis',
      description: 'Detailed expense breakdown and trends',
      module: 'financial' as const,
      type: 'expense-analysis',
      defaultFormat: 'excel' as const,
      filters: [
        { key: 'expenseCategory', label: 'Expense Category', type: 'select' as const, options: ['All', 'Salaries', 'Rent', 'Marketing', 'Utilities', 'Supplies'] },
        { key: 'vendor', label: 'Vendor', type: 'text' as const },
        { key: 'amountRange', label: 'Amount Range', type: 'number' as const }
      ]
    }
  ],
  sales: [
    {
      id: 'sales-performance',
      name: 'Sales Performance',
      description: 'Revenue, deals, and conversion metrics',
      module: 'sales' as const,
      type: 'sales-performance',
      defaultFormat: 'pdf' as const,
      filters: [
        { key: 'salesperson', label: 'Salesperson', type: 'select' as const, options: ['All', 'John Smith', 'Jane Doe', 'Mike Johnson'] },
        { key: 'region', label: 'Region', type: 'select' as const, options: ['All', 'North', 'South', 'East', 'West'] },
        { key: 'productCategory', label: 'Product Category', type: 'select' as const, options: ['All', 'Software', 'Hardware', 'Services'] }
      ]
    },
    {
      id: 'pipeline-analysis',
      name: 'Sales Pipeline Analysis',
      description: 'Deal stages, conversion rates, and forecasting',
      module: 'sales' as const,
      type: 'pipeline-analysis',
      defaultFormat: 'excel' as const,
      filters: [
        { key: 'dealStage', label: 'Deal Stage', type: 'select' as const, options: ['All', 'Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'] },
        { key: 'probability', label: 'Probability Range', type: 'select' as const, options: ['All', 'High (>75%)', 'Medium (25-75%)', 'Low (<25%)'] },
        { key: 'dealSize', label: 'Deal Size Range', type: 'number' as const }
      ]
    },
    {
      id: 'customer-acquisition',
      name: 'Customer Acquisition Report',
      description: 'New customers, acquisition costs, and channels',
      module: 'sales' as const,
      type: 'customer-acquisition',
      defaultFormat: 'pdf' as const,
      filters: [
        { key: 'acquisitionChannel', label: 'Acquisition Channel', type: 'select' as const, options: ['All', 'Website', 'Referral', 'Paid Ads', 'Social Media', 'Email'] },
        { key: 'customerType', label: 'Customer Type', type: 'select' as const, options: ['All', 'Enterprise', 'SMB', 'Startup'] },
        { key: 'timeRange', label: 'Acquisition Period', type: 'select' as const, options: ['Last 30 Days', 'Last Quarter', 'Last Year'] }
      ]
    },
    {
      id: 'revenue-forecast',
      name: 'Revenue Forecast',
      description: 'Projected revenue and growth trends',
      module: 'sales' as const,
      type: 'revenue-forecast',
      defaultFormat: 'excel' as const,
      filters: [
        { key: 'forecastPeriod', label: 'Forecast Period', type: 'select' as const, options: ['Next Month', 'Next Quarter', 'Next Year'] },
        { key: 'confidenceLevel', label: 'Confidence Level', type: 'select' as const, options: ['Conservative', 'Moderate', 'Aggressive'] },
        { key: 'includeSeasonality', label: 'Include Seasonality', type: 'text' as const }
      ]
    }
  ],
  hr: [
    {
      id: 'workforce-summary',
      name: 'Workforce Summary',
      description: 'Headcount, demographics, and organizational structure',
      module: 'hr' as const,
      type: 'workforce-summary',
      defaultFormat: 'pdf' as const,
      filters: [
        { key: 'department', label: 'Department', type: 'select' as const, options: ['All', 'Engineering', 'Sales', 'Marketing', 'HR', 'Finance'] },
        { key: 'employeeType', label: 'Employee Type', type: 'select' as const, options: ['All', 'Full-time', 'Part-time', 'Contract', 'Intern'] },
        { key: 'location', label: 'Location', type: 'select' as const, options: ['All', 'Headquarters', 'Remote', 'Regional Offices'] }
      ]
    },
    {
      id: 'payroll-analysis',
      name: 'Payroll Analysis',
      description: 'Salary costs, bonuses, and compensation trends',
      module: 'hr' as const,
      type: 'payroll-analysis',
      defaultFormat: 'excel' as const,
      filters: [
        { key: 'payType', label: 'Pay Type', type: 'select' as const, options: ['All', 'Salary', 'Hourly', 'Commission'] },
        { key: 'department', label: 'Department', type: 'select' as const, options: ['All', 'Engineering', 'Sales', 'Marketing', 'HR', 'Finance'] },
        { key: 'salaryRange', label: 'Salary Range', type: 'select' as const, options: ['All', '<$50k', '$50k-$100k', '$100k-$150k', '>$150k'] }
      ]
    },
    {
      id: 'attendance-report',
      name: 'Attendance Report',
      description: 'Attendance patterns, leave usage, and time-off analysis',
      module: 'hr' as const,
      type: 'attendance-report',
      defaultFormat: 'excel' as const,
      filters: [
        { key: 'attendanceType', label: 'Attendance Type', type: 'select' as const, options: ['All', 'Present', 'Absent', 'Late', 'Leave'] },
        { key: 'leaveType', label: 'Leave Type', type: 'select' as const, options: ['All', 'Annual', 'Sick', 'Personal', 'Maternity'] },
        { key: 'department', label: 'Department', type: 'select' as const, options: ['All', 'Engineering', 'Sales', 'Marketing', 'HR', 'Finance'] }
      ]
    },
    {
      id: 'performance-reviews',
      name: 'Performance Reviews',
      description: 'Review scores, goals, and development plans',
      module: 'hr' as const,
      type: 'performance-reviews',
      defaultFormat: 'pdf' as const,
      filters: [
        { key: 'reviewPeriod', label: 'Review Period', type: 'select' as const, options: ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024'] },
        { key: 'rating', label: 'Performance Rating', type: 'select' as const, options: ['All', 'Exceeds Expectations', 'Meets Expectations', 'Needs Improvement'] },
        { key: 'department', label: 'Department', type: 'select' as const, options: ['All', 'Engineering', 'Sales', 'Marketing', 'HR', 'Finance'] }
      ]
    },
    {
      id: 'training-analytics',
      name: 'Training Analytics',
      description: 'Training programs, completion rates, and effectiveness',
      module: 'hr' as const,
      type: 'training-analytics',
      defaultFormat: 'pdf' as const,
      filters: [
        { key: 'trainingType', label: 'Training Type', type: 'select' as const, options: ['All', 'Technical', 'Soft Skills', 'Compliance', 'Leadership'] },
        { key: 'completionStatus', label: 'Completion Status', type: 'select' as const, options: ['All', 'Completed', 'In Progress', 'Not Started'] },
        { key: 'department', label: 'Department', type: 'select' as const, options: ['All', 'Engineering', 'Sales', 'Marketing', 'HR', 'Finance'] }
      ]
    }
  ]
};

// Mock API implementation for development
export class MockReportService {
  static async generateReport(params: any): Promise<any> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      id: `report-${Date.now()}`,
      title: `${params.reportType.replace('-', ' ')} Report`,
      type: params.reportType,
      module: params.module,
      dateRange: params.dateRange,
      generatedBy: 'Current User',
      generatedAt: new Date().toISOString(),
      status: 'ready',
      fileUrl: `https://example.com/reports/${Date.now()}.${params.format}`,
      format: params.format,
      size: '2.3 MB',
      downloadCount: 0
    };
  }

  static async getReports(tenantSlug: string, module?: string): Promise<any[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const mockReports = [
      {
        id: 'report-1',
        title: 'Monthly Sales Performance',
        type: 'sales-performance',
        module: 'sales',
        dateRange: { start: '2024-03-01', end: '2024-03-31' },
        generatedBy: 'John Doe',
        generatedAt: '2024-04-01T10:30:00Z',
        status: 'ready',
        fileUrl: 'https://example.com/reports/sales-march.pdf',
        format: 'pdf',
        size: '1.8 MB',
        downloadCount: 5
      },
      {
        id: 'report-2',
        title: 'Q1 Financial Summary',
        type: 'income-statement',
        module: 'financial',
        dateRange: { start: '2024-01-01', end: '2024-03-31' },
        generatedBy: 'Jane Smith',
        generatedAt: '2024-04-02T14:15:00Z',
        status: 'ready',
        fileUrl: 'https://example.com/reports/q1-2024.xlsx',
        format: 'excel',
        size: '3.2 MB',
        downloadCount: 12
      },
      {
        id: 'report-3',
        title: 'Employee Attendance Report',
        type: 'attendance-report',
        module: 'hr',
        dateRange: { start: '2024-03-01', end: '2024-03-31' },
        generatedBy: 'HR Manager',
        generatedAt: '2024-04-03T09:45:00Z',
        status: 'generating',
        format: 'excel',
        size: '1.5 MB',
        downloadCount: 0
      }
    ];

    return module ? mockReports.filter(r => r.module === module) : mockReports;
  }

  static async getReportTemplates(module?: string): Promise<any[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (module) {
      return mockReportTemplates[module as keyof typeof mockReportTemplates] || [];
    }
    
    return [
      ...mockReportTemplates.financial,
      ...mockReportTemplates.sales,
      ...mockReportTemplates.hr
    ];
  }

  static async downloadReport(reportId: string, tenantSlug: string): Promise<string> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return `https://example.com/reports/${reportId}?download=true&tenant=${tenantSlug}`;
  }

  static async deleteReport(reportId: string, tenantSlug: string): Promise<void> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log(`Deleted report ${reportId} for tenant ${tenantSlug}`);
  }

  static async getReportAnalytics(tenantSlug: string): Promise<any> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 400));
    
    return {
      totalReports: 47,
      reportsByModule: {
        financial: 18,
        sales: 15,
        hr: 14
      },
      reportsByType: {
        'income-statement': 8,
        'sales-performance': 6,
        'workforce-summary': 5,
        'balance-sheet': 4,
        'pipeline-analysis': 4,
        'payroll-analysis': 3,
        'cash-flow': 3,
        'attendance-report': 3,
        'customer-acquisition': 2,
        'performance-reviews': 2,
        'expense-analysis': 2,
        'revenue-forecast': 2,
        'training-analytics': 1
      },
      recentActivity: [
        {
          reportId: 'report-1',
          action: 'generated',
          timestamp: '2024-04-03T10:30:00Z',
          user: 'John Doe'
        },
        {
          reportId: 'report-2',
          action: 'downloaded',
          timestamp: '2024-04-03T09:15:00Z',
          user: 'Jane Smith'
        },
        {
          reportId: 'report-3',
          action: 'deleted',
          timestamp: '2024-04-02T16:45:00Z',
          user: 'Admin User'
        }
      ]
    };
  }
}
