import { apiClient } from '@/lib/api-client';
import { TeamMember, TeamDataSubmission, DataSource, TeamWorkflow, TeamAnalytics, DataQualityAlert, TeamCollaboration } from '../types/team-data';

// Mock data for team members
export const mockTeamMembers: TeamMember[] = [
  {
    id: 'member-1',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@company.com',
    department: 'sales',
    role: 'manager',
    position: 'Sales Manager',
    isActive: true,
    permissions: {
      canSubmitData: true,
      canApproveData: true,
      canViewReports: true,
      canGenerateReports: true,
      canManageTeam: false,
      canConfigureIntegrations: false,
      allowedDataTypes: ['sales', 'financial'],
      allowedDepartments: ['sales', 'finance']
    },
    joinedAt: '2023-01-15T00:00:00Z',
    lastActiveAt: '2024-04-03T10:30:00Z'
  },
  {
    id: 'member-2',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane.doe@company.com',
    department: 'finance',
    role: 'contributor',
    position: 'Financial Analyst',
    isActive: true,
    permissions: {
      canSubmitData: true,
      canApproveData: false,
      canViewReports: true,
      canGenerateReports: false,
      canManageTeam: false,
      canConfigureIntegrations: false,
      allowedDataTypes: ['financial'],
      allowedDepartments: ['finance']
    },
    joinedAt: '2023-03-20T00:00:00Z',
    lastActiveAt: '2024-04-03T09:15:00Z'
  },
  {
    id: 'member-3',
    firstName: 'Mike',
    lastName: 'Johnson',
    email: 'mike.johnson@company.com',
    department: 'hr',
    role: 'admin',
    position: 'HR Director',
    isActive: true,
    permissions: {
      canSubmitData: true,
      canApproveData: true,
      canViewReports: true,
      canGenerateReports: true,
      canManageTeam: true,
      canConfigureIntegrations: true,
      allowedDataTypes: ['hr', 'financial', 'sales', 'operations'],
      allowedDepartments: ['hr', 'finance', 'sales', 'operations', 'management']
    },
    joinedAt: '2022-11-10T00:00:00Z',
    lastActiveAt: '2024-04-03T11:45:00Z'
  }
];

// Mock data submissions
export const mockTeamSubmissions: TeamDataSubmission[] = [
  {
    id: 'submission-1',
    teamMemberId: 'member-1',
    dataType: 'sales',
    period: {
      start: '2024-03-01',
      end: '2024-03-31'
    },
    title: 'March Sales Performance',
    description: 'Monthly sales data including revenue, deals, and conversion rates',
    data: {
      revenue: 125000,
      deals: 45,
      conversionRate: 18.5
    },
    confidence: 'high',
    source: 'manual',
    status: 'approved',
    submittedAt: '2024-04-01T14:30:00Z',
    reviewedAt: '2024-04-02T09:15:00Z',
    reviewedBy: 'member-3',
    qualityScore: 92
  },
  {
    id: 'submission-2',
    teamMemberId: 'member-2',
    dataType: 'financial',
    period: {
      start: '2024-03-01',
      end: '2024-03-31'
    },
    title: 'Q1 Financial Summary',
    description: 'Quarterly financial data including expenses and budget variance',
    data: {
      expenses: 85000,
      budget: 90000,
      variance: -5.6
    },
    confidence: 'medium',
    source: 'manual',
    status: 'under_review',
    submittedAt: '2024-04-02T16:45:00Z',
    qualityScore: 78
  },
  {
    id: 'submission-3',
    teamMemberId: 'member-3',
    dataType: 'hr',
    period: {
      start: '2024-03-01',
      end: '2024-03-31'
    },
    title: 'March HR Metrics',
    description: 'Monthly HR data including headcount and attendance',
    data: {
      headcount: 127,
      attendance: 94.2,
      turnoverRate: 2.1
    },
    confidence: 'high',
    source: 'automated',
    status: 'approved',
    submittedAt: '2024-04-01T10:00:00Z',
    reviewedAt: '2024-04-01T11:30:00Z',
    reviewedBy: 'member-3',
    qualityScore: 96
  }
];

// Mock data sources
export const mockDataSources: DataSource[] = [
  {
    id: 'source-1',
    name: 'Sales CRM Integration',
    type: 'api',
    description: 'Automated pull from Salesforce CRM',
    endpoint: 'https://api.salesforce.com/v2/sales',
    schedule: {
      frequency: 'daily',
      cronExpression: '0 2 * * *',
      timezone: 'America/New_York',
      lastRun: '2024-04-03T02:00:00Z',
      nextRun: '2024-04-04T02:00:00Z'
    },
    format: 'json',
    mappings: [
      {
        sourceField: 'total_revenue',
        targetField: 'revenue',
        validation: { required: true, type: 'number', min: 0 }
      },
      {
        sourceField: 'deal_count',
        targetField: 'deals',
        validation: { required: true, type: 'number', min: 0 }
      }
    ],
    isActive: true,
    teamMemberId: 'member-1',
    createdAt: '2024-02-15T00:00:00Z',
    updatedAt: '2024-03-20T00:00:00Z'
  },
  {
    id: 'source-2',
    name: 'Financial System Export',
    type: 'file',
    description: 'Monthly Excel export from accounting system',
    format: 'excel',
    mappings: [
      {
        sourceField: 'Total_Expenses',
        targetField: 'expenses',
        transformation: 'number_format'
      },
      {
        sourceField: 'Budget_Amount',
        targetField: 'budget',
        transformation: 'number_format'
      }
    ],
    isActive: true,
    teamMemberId: 'member-2',
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: '2024-03-15T00:00:00Z'
  }
];

// Mock team analytics
export const mockTeamAnalytics: TeamAnalytics[] = [
  {
    teamMemberId: 'member-1',
    period: '2024-03',
    metrics: {
      submissionsCount: 8,
      approvedSubmissions: 7,
      rejectedSubmissions: 1,
      averageQualityScore: 89.5,
      averageProcessingTime: 4.2,
      dataTypesSubmitted: ['sales'],
      lastSubmissionDate: '2024-04-01T14:30:00Z'
    },
    rankings: {
      overall: 2,
      department: 1,
      quality: 2,
      quantity: 1
    },
    trends: {
      submissionsTrend: 'up',
      qualityTrend: 'stable',
      efficiencyTrend: 'up'
    }
  },
  {
    teamMemberId: 'member-2',
    period: '2024-03',
    metrics: {
      submissionsCount: 5,
      approvedSubmissions: 4,
      rejectedSubmissions: 1,
      averageQualityScore: 85.2,
      averageProcessingTime: 6.8,
      dataTypesSubmitted: ['financial'],
      lastSubmissionDate: '2024-04-02T16:45:00Z'
    },
    rankings: {
      overall: 3,
      department: 2,
      quality: 3,
      quantity: 3
    },
    trends: {
      submissionsTrend: 'stable',
      qualityTrend: 'up',
      efficiencyTrend: 'down'
    }
  },
  {
    teamMemberId: 'member-3',
    period: '2024-03',
    metrics: {
      submissionsCount: 12,
      approvedSubmissions: 12,
      rejectedSubmissions: 0,
      averageQualityScore: 94.7,
      averageProcessingTime: 2.1,
      dataTypesSubmitted: ['hr', 'financial', 'sales'],
      lastSubmissionDate: '2024-04-01T10:00:00Z'
    },
    rankings: {
      overall: 1,
      department: 1,
      quality: 1,
      quantity: 1
    },
    trends: {
      submissionsTrend: 'up',
      qualityTrend: 'up',
      efficiencyTrend: 'stable'
    }
  }
];

// Mock implementation for development
export class MockTeamDataService {
  static async getTeamMembers(tenantSlug: string): Promise<TeamMember[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockTeamMembers;
  }

  static async createTeamMember(tenantSlug: string, memberData: any): Promise<TeamMember> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const newMember: TeamMember = {
      ...memberData,
      id: `member-${Date.now()}`,
      joinedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString()
    };
    mockTeamMembers.push(newMember);
    return newMember;
  }

  static async updateTeamMember(memberId: string, updates: any, tenantSlug: string): Promise<TeamMember> {
    await new Promise(resolve => setTimeout(resolve, 400));
    const memberIndex = mockTeamMembers.findIndex(m => m.id === memberId);
    if (memberIndex === -1) throw new Error('Member not found');
    
    mockTeamMembers[memberIndex] = { ...mockTeamMembers[memberIndex], ...updates };
    return mockTeamMembers[memberIndex];
  }

  static async deleteTeamMember(memberId: string, tenantSlug: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const memberIndex = mockTeamMembers.findIndex(m => m.id === memberId);
    if (memberIndex === -1) throw new Error('Member not found');
    
    mockTeamMembers.splice(memberIndex, 1);
  }

  static async getTeamSubmissions(tenantSlug: string, filters?: any): Promise<TeamDataSubmission[]> {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    let submissions = [...mockTeamSubmissions];
    
    if (filters?.teamMemberId) {
      submissions = submissions.filter(s => s.teamMemberId === filters.teamMemberId);
    }
    
    if (filters?.dataType) {
      submissions = submissions.filter(s => s.dataType === filters.dataType);
    }
    
    if (filters?.status) {
      submissions = submissions.filter(s => s.status === filters.status);
    }
    
    return submissions;
  }

  static async createTeamSubmission(tenantSlug: string, submissionData: any): Promise<TeamDataSubmission> {
    await new Promise(resolve => setTimeout(resolve, 600));
    
    const newSubmission: TeamDataSubmission = {
      ...submissionData,
      id: `submission-${Date.now()}`,
      submittedAt: new Date().toISOString(),
      status: 'submitted',
      qualityScore: Math.floor(Math.random() * 20) + 80
    };
    
    mockTeamSubmissions.push(newSubmission);
    return newSubmission;
  }

  static async updateTeamSubmission(submissionId: string, updates: any, tenantSlug: string): Promise<TeamDataSubmission> {
    await new Promise(resolve => setTimeout(resolve, 400));
    const submissionIndex = mockTeamSubmissions.findIndex(s => s.id === submissionId);
    if (submissionIndex === -1) throw new Error('Submission not found');
    
    mockTeamSubmissions[submissionIndex] = { ...mockTeamSubmissions[submissionIndex], ...updates };
    return mockTeamSubmissions[submissionIndex];
  }

  static async deleteTeamSubmission(submissionId: string, tenantSlug: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const submissionIndex = mockTeamSubmissions.findIndex(s => s.id === submissionId);
    if (submissionIndex === -1) throw new Error('Submission not found');
    
    mockTeamSubmissions.splice(submissionIndex, 1);
  }

  static async approveTeamSubmission(submissionId: string, reviewerId: string, tenantSlug: string, notes?: string): Promise<TeamDataSubmission> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const submissionIndex = mockTeamSubmissions.findIndex(s => s.id === submissionId);
    if (submissionIndex === -1) throw new Error('Submission not found');
    
    mockTeamSubmissions[submissionIndex] = {
      ...mockTeamSubmissions[submissionIndex],
      status: 'approved',
      reviewedAt: new Date().toISOString(),
      reviewedBy: reviewerId,
      reviewNotes: notes,
      qualityScore: Math.floor(Math.random() * 20) + 80
    };
    
    return mockTeamSubmissions[submissionIndex];
  }

  static async rejectTeamSubmission(submissionId: string, reviewerId: string, reason: string, tenantSlug: string): Promise<TeamDataSubmission> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const submissionIndex = mockTeamSubmissions.findIndex(s => s.id === submissionId);
    if (submissionIndex === -1) throw new Error('Submission not found');
    
    mockTeamSubmissions[submissionIndex] = {
      ...mockTeamSubmissions[submissionIndex],
      status: 'rejected',
      reviewedAt: new Date().toISOString(),
      reviewedBy: reviewerId,
      reviewNotes: reason
    };
    
    return mockTeamSubmissions[submissionIndex];
  }

  static async getDataSources(tenantSlug: string, teamMemberId?: string): Promise<DataSource[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (teamMemberId) {
      return mockDataSources.filter(s => s.teamMemberId === teamMemberId);
    }
    
    return mockDataSources;
  }

  static async createDataSource(tenantSlug: string, sourceData: any): Promise<DataSource> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const newSource: DataSource = {
      ...sourceData,
      id: `source-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    mockDataSources.push(newSource);
    return newSource;
  }

  static async testDataSource(sourceId: string, tenantSlug: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: Math.random() > 0.2,
      message: Math.random() > 0.2 ? 'Connection successful' : 'Connection failed',
      sampleData: Math.random() > 0.2 ? { test: 'data' } : null
    };
  }

  static async getTeamAnalytics(tenantSlug: string, period?: any): Promise<TeamAnalytics[]> {
    await new Promise(resolve => setTimeout(resolve, 400));
    return mockTeamAnalytics;
  }

  static async getTeamLeaderboard(tenantSlug: string, metric: string): Promise<any[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return mockTeamAnalytics
      .sort((a, b) => {
        switch (metric) {
          case 'quality':
            return b.metrics.averageQualityScore - a.metrics.averageQualityScore;
          case 'quantity':
            return b.metrics.submissionsCount - a.metrics.submissionsCount;
          case 'efficiency':
            return a.metrics.averageProcessingTime - b.metrics.averageProcessingTime;
          default:
            return b.metrics.approvedSubmissions - a.metrics.approvedSubmissions;
        }
      })
      .map((analytics, index) => ({
        teamMemberId: analytics.teamMemberId,
        rank: index + 1,
        score: metric === 'quality' ? analytics.metrics.averageQualityScore :
              metric === 'quantity' ? analytics.metrics.submissionsCount :
              metric === 'efficiency' ? (100 - analytics.metrics.averageProcessingTime * 10) :
              analytics.metrics.approvedSubmissions,
        trend: analytics.trends.submissionsTrend
      }));
  }

  static async uploadTeamFile(tenantSlug: string, file: File, metadata?: any): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    return {
      id: `file-${Date.now()}`,
      name: file.name,
      type: file.type,
      size: file.size,
      url: `https://example.com/files/${file.name}`
    };
  }

  static async sendTeamNotification(tenantSlug: string, notification: any): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    console.log('Notification sent:', notification);
  }

  // Additional methods with mock implementations
  static async getTeamWorkflows(tenantSlug: string): Promise<TeamWorkflow[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return [];
  }

  static async createTeamWorkflow(tenantSlug: string, workflowData: any): Promise<TeamWorkflow> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      ...workflowData,
      id: `workflow-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
  }

  static async executeWorkflow(workflowId: string, triggerData: any, tenantSlug: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      success: true,
      results: { processed: true },
      errors: []
    };
  }

  static async getDataQualityAlerts(tenantSlug: string, filters?: any): Promise<DataQualityAlert[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return [];
  }

  static async resolveQualityAlert(alertId: string, resolvedBy: string, notes?: string, tenantSlug: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  static async getTeamCollaboration(tenantSlug: string, teamMemberId?: string): Promise<TeamCollaboration[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return [];
  }

  static async createCollaborationActivity(tenantSlug: string, activity: any): Promise<TeamCollaboration> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      ...activity,
      id: `collab-${Date.now()}`,
      createdAt: new Date().toISOString(),
      isRead: false
    };
  }

  static async markCollaborationAsRead(activityId: string, teamMemberId: string, tenantSlug: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}
