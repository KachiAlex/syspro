import { apiClient } from '@/lib/api-client';

export interface ProjectFormData {
  name: string;
  description: string;
  startDate: string;
  dueDate: string;
  budget: string;
  manager: string;
  teamMembers: string[];
  priority: 'low' | 'medium' | 'high';
  status: 'planning' | 'in_progress' | 'on_hold';
}

export interface ProjectResponse {
  id: string;
  name: string;
  description: string;
  status: string;
  progress: number;
  startDate: string;
  dueDate: string;
  teamMembers: number;
  budget: string;
  manager: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
}

export class ProjectService {
  static async createProject(tenantSlug: string, projectData: ProjectFormData): Promise<ProjectResponse> {
    try {
      const response = await apiClient.post(`/projects`, {
        ...projectData,
        tenantSlug,
        budget: projectData.budget.replace(/[$,]/g, ''), // Remove currency symbols and commas
      });

      return response.data.project;
    } catch (error) {
      console.error('Failed to create project:', error);
      throw new Error('Failed to create project. Please try again.');
    }
  }

  static async getProjects(tenantSlug: string, filters?: {
    status?: string;
    search?: string;
    manager?: string;
  }): Promise<ProjectResponse[]> {
    try {
      const params = new URLSearchParams();
      params.append('tenantSlug', tenantSlug);
      
      if (filters?.status && filters.status !== 'All') {
        params.append('status', filters.status);
      }
      
      if (filters?.search) {
        params.append('search', filters.search);
      }
      
      if (filters?.manager) {
        params.append('manager', filters.manager);
      }

      const response = await apiClient.get(`/projects?${params.toString()}`);
      return response.data.projects || [];
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      // Return empty array on error to prevent UI crashes
      return [];
    }
  }

  static async updateProject(tenantSlug: string, projectId: string, updates: Partial<ProjectFormData>): Promise<ProjectResponse> {
    try {
      const response = await apiClient.patch(`/projects/${projectId}`, {
        ...updates,
        tenantSlug,
        budget: updates.budget?.replace(/[$,]/g, ''), // Remove currency symbols and commas
      });

      return response.data.project;
    } catch (error) {
      console.error('Failed to update project:', error);
      throw new Error('Failed to update project. Please try again.');
    }
  }

  static async deleteProject(tenantSlug: string, projectId: string): Promise<void> {
    try {
      await apiClient.delete(`/projects/${projectId}?tenantSlug=${tenantSlug}`);
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw new Error('Failed to delete project. Please try again.');
    }
  }

  static async archiveProject(tenantSlug: string, projectId: string): Promise<void> {
    try {
      await apiClient.patch(`/projects/${projectId}/archive`, {
        tenantSlug
      });
    } catch (error) {
      console.error('Failed to archive project:', error);
      throw new Error('Failed to archive project. Please try again.');
    }
  }

  static async restoreProject(tenantSlug: string, projectId: string): Promise<ProjectResponse> {
    try {
      const response = await apiClient.patch(`/projects/${projectId}/restore`, {
        tenantSlug
      });

      return response.data.project;
    } catch (error) {
      console.error('Failed to restore project:', error);
      throw new Error('Failed to restore project. Please try again.');
    }
  }

  static async getArchivedProjects(tenantSlug: string, filters?: {
    search?: string;
    manager?: string;
  }): Promise<ProjectResponse[]> {
    try {
      const response = await apiClient.get(`/projects/archive?tenantSlug=${encodeURIComponent(tenantSlug)}`);
      let projects: ProjectResponse[] = response.data.projects || [];
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        projects = projects.filter((p) => p.name.toLowerCase().includes(q) || p.manager.toLowerCase().includes(q));
      }
      if (filters?.manager) {
        const q = filters.manager.toLowerCase();
        projects = projects.filter((p) => p.manager.toLowerCase().includes(q));
      }
      return projects;
    } catch (error) {
      console.error('Failed to fetch archived projects:', error);
      return [];
    }
  }

  static async bulkRestoreProjects(tenantSlug: string, projectIds: string[]): Promise<void> {
    try {
      await apiClient.post(`/projects/restore`, {
        tenantSlug,
        projectIds
      });
    } catch (error) {
      console.error('Failed to bulk restore projects:', error);
      throw new Error('Failed to restore selected projects. Please try again.');
    }
  }

  static async getProjectStats(tenantSlug: string): Promise<{
    total: number;
    active: number;
    completed: number;
    archived: number;
    totalBudget: number;
    completionRate: number;
    avgDuration: number;
  }> {
    try {
      const response = await apiClient.get(`/projects/stats?tenantSlug=${encodeURIComponent(tenantSlug)}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch project stats:', error);
      // Return default stats on error
      return {
        total: 0,
        active: 0,
        completed: 0,
        archived: 0,
        totalBudget: 0,
        completionRate: 0,
        avgDuration: 0,
      };
    }
  }
}
