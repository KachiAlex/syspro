import { apiClient } from '@/lib/api-client';

export interface TaskAssignee {
  id: string;
  name: string;
  department: string;
}

export interface TaskResponse {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee: string;
  assignedEmployees: TaskAssignee[];
  dueDate: string;
}

export interface TaskFormData {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  status?: 'todo' | 'in-progress' | 'done' | 'blocked';
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  departmentId: string;
  departmentName?: string;
  jobTitle: string;
  status: string;
}

export class TaskService {
  static async getTasks(projectId: string): Promise<TaskResponse[]> {
    try {
      const response = await apiClient.get(`/projects/${projectId}/tasks`);
      return response.data.tasks || [];
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      return [];
    }
  }

  static async createTask(projectId: string, data: TaskFormData): Promise<TaskResponse> {
    const response = await apiClient.post(`/projects/${projectId}/tasks`, data);
    return response.data.task;
  }

  static async updateTask(projectId: string, taskId: string, updates: Partial<TaskFormData>): Promise<TaskResponse> {
    const response = await apiClient.patch(`/projects/${projectId}/tasks/${taskId}`, updates);
    return response.data.task;
  }

  static async deleteTask(projectId: string, taskId: string): Promise<void> {
    await apiClient.delete(`/projects/${projectId}/tasks/${taskId}`);
  }

  static async getAssignments(projectId: string, taskId: string): Promise<TaskAssignee[]> {
    const response = await apiClient.get(`/projects/${projectId}/tasks/${taskId}/assign`);
    return (response.data.assignments || []).map((a: any) => ({
      id: a.employeeId,
      name: a.employeeName,
      department: a.departmentName,
      assignmentId: a.id,
    }));
  }

  // Assign one or more employees to a task. Any employee may be assigned
  // regardless of department — no restriction is applied here.
  static async assignEmployees(projectId: string, taskId: string, employeeIds: string[]): Promise<void> {
    await apiClient.post(`/projects/${projectId}/tasks/${taskId}/assign`, { employeeIds });
  }

  static async removeAssignment(projectId: string, taskId: string, assignmentId: string): Promise<void> {
    await apiClient.delete(`/projects/${projectId}/tasks/${taskId}/assign?assignmentId=${assignmentId}`);
  }

  // Fetch all employees tenant-wide, optionally filtered by department.
  // Passing no departmentId returns staff across every department.
  static async getEmployees(departmentId?: string): Promise<Employee[]> {
    try {
      const params = new URLSearchParams();
      if (departmentId) params.append('departmentId', departmentId);
      params.append('status', 'active');
      params.append('limit', '500');
      const response = await apiClient.get(`/hr/employees?${params.toString()}`);
      return response.data.employees || [];
    } catch (error) {
      console.error('Failed to fetch employees:', error);
      return [];
    }
  }

  static async getDepartments(tenantSlug: string): Promise<{ id: string; name: string }[]> {
    try {
      const response = await apiClient.get(`/hr/departments?tenantSlug=${encodeURIComponent(tenantSlug)}`);
      return response.data.departments || [];
    } catch (error) {
      console.error('Failed to fetch departments:', error);
      return [];
    }
  }
}
