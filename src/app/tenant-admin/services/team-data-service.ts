import { apiClient } from '@/lib/api-client';
import { TeamMember, TeamDataSubmission, DataSource, TeamWorkflow, TeamAnalytics, DataQualityAlert, TeamCollaboration } from '../types/team-data';

export class TeamDataService {
  // Team Member Management
  static async getTeamMembers(tenantSlug: string): Promise<TeamMember[]> {
    try {
      const response = await apiClient.get(`/team/members?tenantSlug=${tenantSlug}`);
      return response.data.members || [];
    } catch (error) {
      console.error('Failed to fetch team members:', error);
      return [];
    }
  }

  static async createTeamMember(tenantSlug: string, memberData: Omit<TeamMember, 'id' | 'joinedAt' | 'lastActiveAt'>): Promise<TeamMember> {
    try {
      const response = await apiClient.post('/team/members', { ...memberData, tenantSlug });
      return response.data;
    } catch (error) {
      console.error('Failed to create team member:', error);
      throw new Error('Failed to create team member. Please try again.');
    }
  }

  static async updateTeamMember(memberId: string, updates: Partial<TeamMember>, tenantSlug: string): Promise<TeamMember> {
    try {
      const response = await apiClient.patch(`/team/members/${memberId}`, { ...updates, tenantSlug });
      return response.data;
    } catch (error) {
      console.error('Failed to update team member:', error);
      throw new Error('Failed to update team member. Please try again.');
    }
  }

  static async deleteTeamMember(memberId: string, tenantSlug: string): Promise<void> {
    try {
      await apiClient.delete(`/team/members/${memberId}?tenantSlug=${tenantSlug}`);
    } catch (error) {
      console.error('Failed to delete team member:', error);
      throw new Error('Failed to delete team member. Please try again.');
    }
  }

  // Data Submission Management
  static async getTeamSubmissions(tenantSlug: string, filters?: {
    teamMemberId?: string;
    dataType?: string;
    status?: string;
    period?: { start: string; end: string };
  }): Promise<TeamDataSubmission[]> {
    try {
      const params = new URLSearchParams({ tenantSlug });
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) {
            if (typeof value === 'object') {
              params.append(key, JSON.stringify(value));
            } else {
              params.append(key, value);
            }
          }
        });
      }
      
      const response = await apiClient.get(`/team/submissions?${params.toString()}`);
      return response.data.submissions || [];
    } catch (error) {
      console.error('Failed to fetch team submissions:', error);
      return [];
    }
  }

  static async createTeamSubmission(tenantSlug: string, submissionData: Omit<TeamDataSubmission, 'id' | 'submittedAt' | 'status'>): Promise<TeamDataSubmission> {
    try {
      const response = await apiClient.post('/team/submissions', { ...submissionData, tenantSlug });
      return response.data;
    } catch (error) {
      console.error('Failed to create team submission:', error);
      throw new Error('Failed to submit data. Please try again.');
    }
  }

  static async updateTeamSubmission(submissionId: string, updates: Partial<TeamDataSubmission>, tenantSlug: string): Promise<TeamDataSubmission> {
    try {
      const response = await apiClient.patch(`/team/submissions/${submissionId}`, { ...updates, tenantSlug });
      return response.data;
    } catch (error) {
      console.error('Failed to update team submission:', error);
      throw new Error('Failed to update submission. Please try again.');
    }
  }

  static async deleteTeamSubmission(submissionId: string, tenantSlug: string): Promise<void> {
    try {
      await apiClient.delete(`/team/submissions/${submissionId}?tenantSlug=${tenantSlug}`);
    } catch (error) {
      console.error('Failed to delete team submission:', error);
      throw new Error('Failed to delete submission. Please try again.');
    }
  }

  static async approveTeamSubmission(submissionId: string, reviewerId: string, tenantSlug: string, notes?: string): Promise<TeamDataSubmission> {
    try {
      const response = await apiClient.post(`/team/submissions/${submissionId}/approve`, {
        reviewerId,
        notes,
        tenantSlug
      });
      return response.data;
    } catch (error) {
      console.error('Failed to approve team submission:', error);
      throw new Error('Failed to approve submission. Please try again.');
    }
  }

  static async rejectTeamSubmission(submissionId: string, reviewerId: string, reason: string, tenantSlug: string): Promise<TeamDataSubmission> {
    try {
      const response = await apiClient.post(`/team/submissions/${submissionId}/reject`, {
        reviewerId,
        reason,
        tenantSlug
      });
      return response.data;
    } catch (error) {
      console.error('Failed to reject team submission:', error);
      throw new Error('Failed to reject submission. Please try again.');
    }
  }

  // Data Source Management
  static async getDataSources(tenantSlug: string, teamMemberId?: string): Promise<DataSource[]> {
    try {
      const params = new URLSearchParams({ tenantSlug });
      if (teamMemberId) params.append('teamMemberId', teamMemberId);
      
      const response = await apiClient.get(`/team/data-sources?${params.toString()}`);
      return response.data.dataSources || [];
    } catch (error) {
      console.error('Failed to fetch data sources:', error);
      return [];
    }
  }

  static async testDataSource(sourceId: string, tenantSlug: string): Promise<{
    success: boolean;
    message: string;
    sampleData?: any;
  }> {
    try {
      const response = await apiClient.post(`/team/data-sources/${sourceId}/test`, { tenantSlug });
      return response.data;
    } catch (error) {
      console.error('Failed to test data source:', error);
      return {
        success: false,
        message: 'Failed to connect to data source. Please check your configuration.'
      };
    }
  }

  // Analytics and Insights
  static async getTeamAnalytics(tenantSlug: string, period?: { start: string; end: string }): Promise<TeamAnalytics[]> {
    try {
      const params = new URLSearchParams({ tenantSlug });
      if (period) {
        params.append('period', JSON.stringify(period));
      }
      
      const response = await apiClient.get(`/team/analytics?${params.toString()}`);
      return response.data.analytics || [];
    } catch (error) {
      console.error('Failed to fetch team analytics:', error);
      return [];
    }
  }

  static async getTeamLeaderboard(tenantSlug: string, metric: 'quantity' | 'quality' | 'efficiency' | 'overall'): Promise<Array<{
    teamMemberId: string;
    rank: number;
    score: number;
    trend: 'up' | 'down' | 'stable';
  }>> {
    try {
      const response = await apiClient.get(`/team/leaderboard?metric=${metric}&tenantSlug=${tenantSlug}`);
      return response.data.leaderboard || [];
    } catch (error) {
      console.error('Failed to fetch team leaderboard:', error);
      return [];
    }
  }

  // File Upload
  static async uploadTeamFile(tenantSlug: string, file: File, metadata?: {
    submissionId?: string;
    dataSourceId?: string;
    description?: string;
  }): Promise<{
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
  }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tenantSlug', tenantSlug);
      
      if (metadata) {
        Object.entries(metadata).forEach(([key, value]) => {
          if (value) formData.append(key, value);
        });
      }

      const response = await apiClient.post('/team/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      return response.data;
    } catch (error) {
      console.error('Failed to upload team file:', error);
      throw new Error('Failed to upload file. Please try again.');
    }
  }

  // Notifications
  static async sendTeamNotification(tenantSlug: string, notification: {
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    recipients: string[]; // team member IDs
    actionUrl?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await apiClient.post('/team/notifications', { ...notification, tenantSlug });
    } catch (error) {
      console.error('Failed to send team notification:', error);
      throw new Error('Failed to send notification. Please try again.');
    }
  }
}
