import { apiClient } from '@/lib/api-client';
import type {
  EmployeeRecord,
  DepartmentRecord,
  AttendanceRecord,
  LeaveRecord,
  JobRequisitionRecord,
  CandidateRecord,
  ApplicationRecord,
  InterviewRecord,
  OfferRecord,
  OnboardingTaskRecord,
  ScreeningResult,
  ScreeningConfigRecord,
  BatchScreeningResult,
} from '@/lib/hr/types';

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
    await apiClient.post('/hr/attendance', { tenantSlug, records });
  }

  static async getAttendanceRecords(tenantSlug: string, filters?: {
    date?: string;
    employeeId?: string;
    status?: string;
  }): Promise<AttendanceRecord[]> {
    const params = new URLSearchParams({ tenantSlug });
    if (filters?.date) params.append('date', filters.date);
    if (filters?.employeeId) params.append('employeeId', filters.employeeId);
    if (filters?.status) params.append('status', filters.status);

    const response = await apiClient.get(`/hr/attendance?${params.toString()}`);
    return response.data.records || [];
  }

  static async getAttendanceStats(tenantSlug: string, date: string): Promise<{
    present: number;
    absent: number;
    late: number;
    halfDay: number;
    total: number;
  }> {
    const response = await apiClient.get(`/hr/attendance?tenantSlug=${tenantSlug}&statsDate=${date}`);
    return response.data;
  }

  // Leave Management
  static async submitLeaveRequest(tenantSlug: string, request: {
    employeeId: string;
    employeeName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    reason: string;
  }): Promise<LeaveRecord> {
    const response = await apiClient.post('/hr/leave', { ...request, tenantSlug });
    return response.data.request;
  }

  static async getLeaveRequests(tenantSlug: string, filters?: {
    employeeId?: string;
    status?: string;
    leaveType?: string;
  }): Promise<LeaveRecord[]> {
    const params = new URLSearchParams({ tenantSlug });
    if (filters?.employeeId) params.append('employeeId', filters.employeeId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.leaveType) params.append('leaveType', filters.leaveType);

    const response = await apiClient.get(`/hr/leave?${params.toString()}`);
    return response.data.requests || [];
  }

  static async updateLeaveStatus(tenantSlug: string, requestId: string, status: 'approved' | 'rejected' | 'cancelled'): Promise<void> {
    await apiClient.patch(`/hr/leave/${requestId}`, { tenantSlug, status });
  }

  static async getLeaveBalance(tenantSlug: string, employeeId: string): Promise<{
    annual: { used: number; total: number };
    sick: { used: number; total: number };
    personal: { used: number; total: number };
    maternity: { used: number; total: number };
  }> {
    const response = await apiClient.get(`/hr/leave?tenantSlug=${tenantSlug}&employeeId=${employeeId}`);
    return response.data;
  }

  // Report Management
  static async generateReport(tenantSlug: string, reportData: {
    reportType: string;
    startDate: string;
    endDate: string;
    includeCharts: boolean;
    format: string;
  }): Promise<HRReport> {
    const response = await apiClient.post('/hr/reports', { ...reportData, tenantSlug });
    return response.data;
  }

  static async getReports(tenantSlug: string): Promise<HRReport[]> {
    const response = await apiClient.get(`/hr/staff-reports?tenantSlug=${tenantSlug}`);
    const reports = response.data.reports || [];
    return reports.map((r: any) => ({
      id: r.id,
      title: r.title || `${r.reportType?.replace(/_/g, ' ')} Report`,
      type: r.reportType || 'workforce',
      dateRange: r.dateRange || { start: r.reportDate || '', end: r.reportDate || '' },
      generatedBy: r.generatedBy || r.headOfDepartment || '',
      generatedAt: r.generatedAt || r.submittedAt || '',
      status: r.status || 'pending',
      fileUrl: r.fileUrl,
    }));
  }

  static async getStaffReports(tenantSlug: string): Promise<any[]> {
    const response = await apiClient.get(`/hr/staff-reports?tenantSlug=${tenantSlug}`);
    return response.data.reports || [];
  }

  static async submitStaffReport(tenantSlug: string, reportData: {
    employeeId: string;
    title?: string;
    reportType: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    reportDate: string;
    rawTranscript?: string;
    refinedText?: string;
    objectives?: string;
    achievements?: string;
    challenges?: string;
    nextSteps?: string;
    additionalNotes?: string;
    meetings?: string;
    blockers?: string;
    activities?: string;
    headOfDepartment: string;
    teamMembers?: string[];
    appraisal?: any;
    templateId?: string | null;
    templateSnapshot?: any;
    departmentId?: string | null;
    resubmissionOfId?: string | null;
    version?: number;
  }): Promise<any> {
    const response = await apiClient.post('/hr/staff-reports', { ...reportData, tenantSlug });
    return response.data.report;
  }

  static async updateStaffReportStatus(tenantSlug: string, reportId: string, status: 'pending' | 'under_review' | 'approved' | 'needs_edit' | 'rejected', hodComment?: string): Promise<void> {
    await apiClient.put('/hr/staff-reports', { reportId, status, tenantSlug, hodComment });
  }

  static async getStaffTasks(tenantSlug: string, filters?: { employeeId?: string; status?: string; dueDate?: string; dueBefore?: string }): Promise<any[]> {
    const params = new URLSearchParams();
    params.append('tenantSlug', tenantSlug);
    if (filters?.employeeId) params.append('employeeId', filters.employeeId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.dueDate) params.append('dueDate', filters.dueDate);
    if (filters?.dueBefore) params.append('dueBefore', filters.dueBefore);
    const response = await apiClient.get(`/hr/staff-tasks?${params.toString()}`);
    return response.data.tasks || [];
  }

  static async createStaffTask(tenantSlug: string, taskData: {
    employeeId: string;
    title: string;
    description?: string;
    expectedOutcome?: string;
    weight?: number;
    isKpi?: boolean;
    frequency: 'daily' | 'weekly' | 'one-time';
    dueDate: string;
    status?: 'pending' | 'in_progress' | 'completed' | 'overdue';
    assignedBy: string;
  }): Promise<any> {
    const response = await apiClient.post('/hr/staff-tasks', { ...taskData, tenantSlug });
    return response.data.task;
  }

  static async updateStaffTask(tenantSlug: string, taskId: string, updates: {
    title?: string;
    description?: string;
    expectedOutcome?: string;
    weight?: number;
    isKpi?: boolean;
    frequency?: 'daily' | 'weekly' | 'one-time';
    dueDate?: string;
    status?: 'pending' | 'in_progress' | 'completed' | 'overdue';
  }): Promise<any> {
    const response = await apiClient.put('/hr/staff-tasks', { taskId, tenantSlug, ...updates });
    return response.data.task;
  }

  static async deleteStaffTask(tenantSlug: string, taskId: string): Promise<void> {
    await apiClient.delete(`/hr/staff-tasks?tenantSlug=${tenantSlug}&taskId=${taskId}`);
  }

  static async getStaffReportTemplates(tenantSlug: string, reportType?: string): Promise<any[]> {
    const params = new URLSearchParams();
    params.append('tenantSlug', tenantSlug);
    if (reportType) params.append('reportType', reportType);
    const response = await apiClient.get(`/hr/staff-report-templates?${params.toString()}`);
    return response.data.templates || [];
  }

  static async createStaffReportTemplate(tenantSlug: string, template: {
    reportType: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    name: string;
    isDefault?: boolean;
    sections?: any[];
    createdBy?: string;
  }): Promise<any> {
    const response = await apiClient.post('/hr/staff-report-templates', { ...template, tenantSlug });
    return response.data.template;
  }

  static async updateStaffReportTemplate(tenantSlug: string, templateId: string, updates: {
    reportType?: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    name?: string;
    isDefault?: boolean;
    sections?: any[];
  }): Promise<any> {
    const response = await apiClient.put('/hr/staff-report-templates', { id: templateId, tenantSlug, ...updates });
    return response.data.template;
  }

  static async deleteStaffReportTemplate(tenantSlug: string, templateId: string): Promise<void> {
    await apiClient.delete(`/hr/staff-report-templates?tenantSlug=${tenantSlug}&id=${templateId}`);
  }

  static async downloadReport(tenantSlug: string, reportId: string): Promise<string> {
    const response = await apiClient.get(`/hr/reports/${reportId}/download?tenantSlug=${tenantSlug}`);
    return response.data.fileUrl;
  }

  static async deleteReport(tenantSlug: string, reportId: string): Promise<void> {
    await apiClient.delete(`/hr/staff-reports?tenantSlug=${tenantSlug}&reportId=${reportId}`);
  }

  // Employee Management
  static async addEmployee(tenantSlug: string, employeeData: {
    firstName: string;
    lastName: string;
    email: string;
    department: string;
    position: string;
    startDate: string;
    salary?: string;
    employmentType: string;
    role?: string;
    activatePortal?: boolean;
    password?: string;
  }): Promise<{ employee: EmployeeRecord; portalCredentials: { email: string; password: string } | null }> {
    const payload = {
      tenantSlug,
      name: `${employeeData.firstName} ${employeeData.lastName}`.trim(),
      email: employeeData.email,
      departmentName: employeeData.department,
      jobTitle: employeeData.position,
      hireDate: employeeData.startDate ? new Date(employeeData.startDate).toISOString() : undefined,
      salary: employeeData.salary ? Number(employeeData.salary.replace(/[^0-9.]/g, '')) : undefined,
      employmentType: employeeData.employmentType?.toLowerCase().replace(/\s/g, '-') as any,
      role: (employeeData.role || 'Staff').toLowerCase(),
      activatePortal: employeeData.activatePortal ?? false,
      password: employeeData.password,
    };
    const response = await apiClient.post('/hr/employees', payload);
    return {
      employee: response.data.employee,
      portalCredentials: response.data.portalCredentials ?? null,
    };
  }

  static async updateEmployee(tenantSlug: string, employeeId: string, employeeData: {
    firstName?: string;
    lastName?: string;
    email?: string;
    department?: string;
    position?: string;
    startDate?: string;
    status?: string;
    salary?: string;
    role?: string;
  }): Promise<EmployeeRecord> {
    const payload: Record<string, any> = { tenantSlug };
    if (employeeData.firstName || employeeData.lastName) {
      payload.name = `${employeeData.firstName || ''} ${employeeData.lastName || ''}`.trim();
    }
    if (employeeData.email) payload.email = employeeData.email;
    if (employeeData.department) {
      payload.departmentName = employeeData.department;
    }
    if (employeeData.position) payload.jobTitle = employeeData.position;
    if (employeeData.status) payload.status = employeeData.status.toLowerCase().replace(/\s/g, '-') as any;
    if (employeeData.salary) payload.salary = Number(employeeData.salary.replace(/[^0-9.]/g, ''));
    if (employeeData.startDate) payload.hireDate = new Date(employeeData.startDate).toISOString();
    if (employeeData.role) payload.role = employeeData.role.toLowerCase();

    const response = await apiClient.patch(`/hr/employees/${employeeId}`, payload);
    return response.data.employee;
  }

  static async deleteEmployee(tenantSlug: string, employeeId: string): Promise<void> {
    await apiClient.delete(`/hr/employees/${employeeId}?tenantSlug=${tenantSlug}`);
  }

  static async importEmployeesFromExcel(tenantSlug: string, file: File, defaultPassword?: string): Promise<{
    imported: number;
    failed: number;
    errors: string[];
    warnings?: string[];
    portalAccountsCreated?: number;
    portalCredentials?: Array<{ name: string; email: string; password: string }>;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tenantSlug', tenantSlug);
    if (defaultPassword) {
      formData.append('defaultPassword', defaultPassword);
    }

    const response = await apiClient.post('/hr/employees/import', formData);
    return response.data;
  }

  static async generateInviteLink(tenantSlug: string, emails: string[]): Promise<{
    link: string;
    expiresAt: string;
    maxUses: number;
  }> {
    const response = await apiClient.post('/hr/employees/invite', { tenantSlug, emails });
    return response.data;
  }

  static async getEmployees(tenantSlug: string, opts?: { limit?: number; offset?: number }): Promise<Array<{
    id: string;
    name: string;
    email: string;
    department: string;
    position: string;
    role: string;
    status: string;
    salary: number;
    startDate: string;
    employmentType?: string;
    isPortalActive: boolean;
    lastLogin: string | null;
  }>> {
    const limit = opts?.limit ?? 200;
    const offset = opts?.offset ?? 0;
    const [empRes, deptRes] = await Promise.all([
      apiClient.get(`/hr/employees?tenantSlug=${tenantSlug}&limit=${limit}&offset=${offset}`),
      apiClient.get(`/hr/departments?tenantSlug=${tenantSlug}`),
    ]);
    const employees: EmployeeRecord[] = empRes.data.employees || [];
    const departments: DepartmentRecord[] = deptRes.data.departments || [];
    const deptMap = new Map(departments.map((d) => [d.id, d.name]));

    return employees.map((emp) => ({
      id: emp.id,
      name: emp.name,
      email: emp.email,
      department: deptMap.get(emp.departmentId) || emp.departmentId,
      position: emp.jobTitle,
      role: emp.role ? emp.role.charAt(0).toUpperCase() + emp.role.slice(1) : 'Staff',
      status: emp.status === 'active' ? 'Active' : emp.status === 'on-leave' ? 'On Leave' : emp.status === 'terminated' ? 'Terminated' : 'Inactive',
      salary: emp.salary ?? 0,
      startDate: emp.hireDate ? emp.hireDate.split('T')[0] : '',
      employmentType: emp.employmentType ? emp.employmentType.charAt(0).toUpperCase() + emp.employmentType.slice(1).replace('-', ' ') : 'Full-time',
      isPortalActive: emp.isPortalActive ?? false,
      lastLogin: emp.lastLogin ?? null,
    }));
  }

  static async activateEmployeePortal(tenantSlug: string, employeeIds: string[], defaultPassword?: string): Promise<Array<{ id: string; name: string; email: string; password: string }>> {
    const response = await apiClient.post('/hr/employees/auth/activate', { tenantSlug, employeeIds, defaultPassword });
    return response.data.employees || [];
  }

  static async deactivateEmployeePortal(tenantSlug: string, employeeId: string): Promise<void> {
    await apiClient.patch(`/hr/employees/${employeeId}/portal`, { tenantSlug, isPortalActive: false });
  }

  static async getDepartmentRecords(tenantSlug: string): Promise<DepartmentRecord[]> {
    const response = await apiClient.get(`/hr/departments?tenantSlug=${tenantSlug}`);
    return response.data.departments || [];
  }

  static async getDepartments(tenantSlug: string): Promise<string[]> {
    const depts = await this.getDepartmentRecords(tenantSlug);
    return depts.map((d) => d.name);
  }

  static async createDepartment(tenantSlug: string, data: {
    name: string;
    description?: string;
    parentDepartmentId?: string;
    budget?: number;
    costCenter?: string;
    managerId?: string;
  }): Promise<DepartmentRecord> {
    const response = await apiClient.post('/hr/departments', { ...data, tenantSlug });
    return response.data.department;
  }

  static async updateDepartmentHead(tenantSlug: string, departmentId: string, managerId: string | null): Promise<DepartmentRecord> {
    const response = await apiClient.patch(`/hr/departments/${departmentId}/head`, { managerId, tenantSlug });
    return response.data.department;
  }

  static async getTenantUsers(tenantSlug: string): Promise<{ id: string; email: string; name: string }[]> {
    try {
      const response = await apiClient.get(`/hr/employees?tenantSlug=${tenantSlug}&limit=100`);
      const employees = response.data.employees || [];
      return employees.map((e: any) => ({ id: e.id, email: e.email, name: e.name }));
    } catch {
      return [];
    }
  }

  static async listDepartmentsWithHeads(tenantSlug: string): Promise<(DepartmentRecord & { headName: string | null; headEmail: string | null; employeeCount?: number })[]> {
    const response = await apiClient.get(`/hr/departments?tenantSlug=${tenantSlug}&withHeads=true`);
    return response.data.departments || [];
  }

  // Payroll Management (endpoints not yet implemented)
  static async runPayroll(tenantSlug: string, payrollData: {
    payrollMonth: string;
    payDate: string;
    includeBonuses: boolean;
    processDeductions: boolean;
  }): Promise<{ id: string; period: string; totalAmount: number; employeeCount: number; status: string }> {
    const response = await apiClient.post('/hr/payroll/run', { ...payrollData, tenantSlug });
    return response.data;
  }

  static async getPayrollHistory(tenantSlug: string): Promise<Array<{
    id: string; period: string; totalAmount: number; employeeCount: number; status: string; processedDate: string;
  }>> {
    const response = await apiClient.get(`/hr/payroll/history?tenantSlug=${tenantSlug}`);
    return response.data.history || [];
  }

  // Training Management (endpoints not yet implemented)
  static async createTrainingSession(tenantSlug: string, trainingData: {
    title: string;
    description: string;
    instructor: string;
    startDate: string;
    endDate: string;
    capacity: number;
  }): Promise<{ id: string; title: string; status: string; enrolled: number }> {
    const response = await apiClient.post('/hr/training', { ...trainingData, tenantSlug });
    return response.data;
  }

  static async getTrainingSessions(tenantSlug: string): Promise<Array<{
    id: string; title: string; description: string; instructor: string;
    startDate: string; endDate: string; capacity: number; enrolled: number; status: string;
  }>> {
    const response = await apiClient.get(`/hr/training?tenantSlug=${tenantSlug}`);
    return response.data.sessions || [];
  }

  static async postJob(tenantSlug: string, jobData: {
    title: string;
    department: string;
    description: string;
    requirements: string;
    location: string;
    employmentType: string;
    salaryRange?: string;
  }): Promise<JobRequisitionRecord> {
    const departmentId = await this.resolveDepartmentId(tenantSlug, jobData.department);
    const payload = {
      tenantSlug,
      title: jobData.title,
      departmentId,
      description: jobData.description,
      requirements: jobData.requirements,
      location: jobData.location,
      employmentType: jobData.employmentType.toLowerCase().replace(/\s/g, '-') as any,
      salaryRange: jobData.salaryRange,
      requestedBy: 'system',
    };
    const response = await apiClient.post('/hr/requisitions', payload);
    return response.data.requisition;
  }

  // Recruitment / Talent Acquisition
  static async getRequisitions(tenantSlug: string, filters?: { status?: string; departmentId?: string }): Promise<{ requisitions: JobRequisitionRecord[]; total: number }> {
    const params = new URLSearchParams({ tenantSlug });
    if (filters?.status) params.append('status', filters.status);
    if (filters?.departmentId) params.append('departmentId', filters.departmentId);
    const response = await apiClient.get(`/hr/requisitions?${params.toString()}`);
    return { requisitions: response.data.requisitions || [], total: response.data.total || 0 };
  }

  static async createRequisition(tenantSlug: string, data: {
    title: string;
    departmentId: string;
    description: string;
    employmentType: string;
    requestedBy?: string;
    headcount?: number;
    budget?: number;
    requiredSkills?: string[];
    minExperienceYears?: number;
    requirements?: string;
    location?: string;
    salaryRange?: string;
  }): Promise<JobRequisitionRecord> {
    const response = await apiClient.post('/hr/requisitions', { ...data, tenantSlug });
    return response.data.requisition;
  }

  static async updateRequisition(tenantSlug: string, id: string, data: Partial<JobRequisitionRecord>): Promise<JobRequisitionRecord> {
    const response = await apiClient.patch(`/hr/requisitions/${id}`, { ...data, tenantSlug });
    return response.data.requisition;
  }

  static async deleteRequisition(tenantSlug: string, id: string): Promise<void> {
    await apiClient.delete(`/hr/requisitions/${id}?tenantSlug=${tenantSlug}`);
  }

  static async getCandidates(tenantSlug: string, filters?: { currentStage?: string; source?: string }): Promise<{ candidates: CandidateRecord[]; total: number }> {
    const params = new URLSearchParams({ tenantSlug });
    if (filters?.currentStage) params.append('currentStage', filters.currentStage);
    if (filters?.source) params.append('source', filters.source);
    const response = await apiClient.get(`/hr/candidates?${params.toString()}`);
    return { candidates: response.data.candidates || [], total: response.data.total || 0 };
  }

  static async createCandidate(tenantSlug: string, data: {
    fullName: string;
    email: string;
    phone?: string;
    resumeUrl?: string;
    source?: string;
    currentStage?: string;
    skills?: string[];
    experienceYears?: number;
    education?: string;
    notes?: string;
    tags?: string[];
  }): Promise<CandidateRecord> {
    const response = await apiClient.post('/hr/candidates', { ...data, tenantSlug });
    return response.data.candidate;
  }

  static async updateCandidate(tenantSlug: string, id: string, data: Partial<CandidateRecord>): Promise<CandidateRecord> {
    const response = await apiClient.patch(`/hr/candidates/${id}`, { ...data, tenantSlug });
    return response.data.candidate;
  }

  static async deleteCandidate(tenantSlug: string, id: string): Promise<void> {
    await apiClient.delete(`/hr/candidates/${id}?tenantSlug=${tenantSlug}`);
  }

  static async getApplications(tenantSlug: string, filters?: { candidateId?: string; requisitionId?: string; status?: string }): Promise<{ applications: ApplicationRecord[]; total: number }> {
    const params = new URLSearchParams({ tenantSlug });
    if (filters?.candidateId) params.append('candidateId', filters.candidateId);
    if (filters?.requisitionId) params.append('requisitionId', filters.requisitionId);
    if (filters?.status) params.append('status', filters.status);
    const response = await apiClient.get(`/hr/applications?${params.toString()}`);
    return { applications: response.data.applications || [], total: response.data.total || 0 };
  }

  static async createApplication(tenantSlug: string, data: { candidateId: string; requisitionId: string; coverLetter?: string }): Promise<ApplicationRecord> {
    const response = await apiClient.post('/hr/applications', { ...data, tenantSlug });
    return response.data.application;
  }

  static async updateApplication(tenantSlug: string, id: string, data: Partial<ApplicationRecord>): Promise<ApplicationRecord> {
    const response = await apiClient.patch(`/hr/applications/${id}`, { ...data, tenantSlug });
    return response.data.application;
  }

  static async screenApplication(tenantSlug: string, id: string): Promise<ScreeningResult> {
    const response = await apiClient.post(`/hr/applications/${id}/screen`, { tenantSlug });
    return response.data.result;
  }

  static async getScreeningConfig(tenantSlug: string, requisitionId: string): Promise<ScreeningConfigRecord | null> {
    const response = await apiClient.get(`/hr/requisitions/${requisitionId}/screening-config?tenantSlug=${tenantSlug}`);
    return response.data.config ?? null;
  }

  static async saveScreeningConfig(
    tenantSlug: string,
    requisitionId: string,
    data: {
      selectionMode: 'percentage' | 'fixed_number';
      selectionValue: number;
      minScoreThreshold?: number;
      isEnabled?: boolean;
    }
  ): Promise<ScreeningConfigRecord | null> {
    const response = await apiClient.post(`/hr/requisitions/${requisitionId}/screening-config`, {
      tenantSlug,
      ...data,
    });
    return response.data.config ?? null;
  }

  static async runBatchAIScreening(
    tenantSlug: string,
    requisitionId: string,
    overrides?: {
      selectionMode?: 'percentage' | 'fixed_number';
      selectionValue?: number;
      minScoreThreshold?: number;
    }
  ): Promise<BatchScreeningResult> {
    const response = await apiClient.post(`/hr/requisitions/${requisitionId}/run-ai-screening`, {
      tenantSlug,
      ...overrides,
    });
    return response.data.result;
  }

  static async getInterviews(tenantSlug: string, filters?: { applicationId?: string; status?: string }): Promise<InterviewRecord[]> {
    const params = new URLSearchParams({ tenantSlug });
    if (filters?.applicationId) params.append('applicationId', filters.applicationId);
    if (filters?.status) params.append('status', filters.status);
    const response = await apiClient.get(`/hr/interviews?${params.toString()}`);
    return response.data.interviews || [];
  }

  static async createInterview(tenantSlug: string, data: {
    applicationId: string;
    roundNumber?: number;
    type: string;
    scheduledAt: string;
    interviewerIds: string[];
    notes?: string;
  }): Promise<InterviewRecord> {
    const response = await apiClient.post('/hr/interviews', { ...data, tenantSlug });
    return response.data.interview;
  }

  static async updateInterview(tenantSlug: string, id: string, data: Partial<InterviewRecord>): Promise<InterviewRecord> {
    const response = await apiClient.patch(`/hr/interviews/${id}`, { ...data, tenantSlug });
    return response.data.interview;
  }

  static async deleteInterview(tenantSlug: string, id: string): Promise<void> {
    await apiClient.delete(`/hr/interviews/${id}?tenantSlug=${tenantSlug}`);
  }

  static async getOffers(tenantSlug: string, filters?: { applicationId?: string; status?: string }): Promise<OfferRecord[]> {
    const params = new URLSearchParams({ tenantSlug });
    if (filters?.applicationId) params.append('applicationId', filters.applicationId);
    if (filters?.status) params.append('status', filters.status);
    const response = await apiClient.get(`/hr/offers?${params.toString()}`);
    return response.data.offers || [];
  }

  static async createOffer(tenantSlug: string, data: {
    applicationId: string;
    salary: number;
    bonus?: number;
    benefits?: Record<string, any>;
    startDate: string;
    reportingManagerId: string;
    expiresAt: string;
  }): Promise<OfferRecord> {
    const response = await apiClient.post('/hr/offers', { ...data, tenantSlug });
    return response.data.offer;
  }

  static async updateOffer(tenantSlug: string, id: string, data: Partial<OfferRecord>): Promise<OfferRecord> {
    const response = await apiClient.patch(`/hr/offers/${id}`, { ...data, tenantSlug });
    return response.data.offer;
  }

  static async deleteOffer(tenantSlug: string, id: string): Promise<void> {
    await apiClient.delete(`/hr/offers/${id}?tenantSlug=${tenantSlug}`);
  }

  static async getOnboardingTasks(tenantSlug: string, filters?: { employeeId?: string; category?: string; status?: string; assignedToUserId?: string }): Promise<OnboardingTaskRecord[]> {
    const params = new URLSearchParams({ tenantSlug });
    if (filters?.employeeId) params.append('employeeId', filters.employeeId);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.assignedToUserId) params.append('assignedToUserId', filters.assignedToUserId);
    const response = await apiClient.get(`/hr/onboarding-tasks?${params.toString()}`);
    return response.data.tasks || [];
  }

  static async createOnboardingTask(tenantSlug: string, data: {
    employeeId: string;
    category: string;
    task: string;
    assignedToUserId: string;
    dueDate: string;
  }): Promise<OnboardingTaskRecord> {
    const response = await apiClient.post('/hr/onboarding-tasks', { ...data, tenantSlug });
    return response.data.task;
  }

  static async updateOnboardingTask(tenantSlug: string, id: string, data: Partial<OnboardingTaskRecord>): Promise<OnboardingTaskRecord> {
    const response = await apiClient.patch(`/hr/onboarding-tasks/${id}`, { ...data, tenantSlug });
    return response.data.task;
  }

  static async deleteOnboardingTask(tenantSlug: string, id: string): Promise<void> {
    await apiClient.delete(`/hr/onboarding-tasks/${id}?tenantSlug=${tenantSlug}`);
  }

  static async getTenantCurrency(tenantSlug: string): Promise<string> {
    try {
      const response = await apiClient.get(`/tenant/settings?tenantSlug=${tenantSlug}`);
      return response.data.currency || 'USD';
    } catch {
      return 'USD';
    }
  }

  static async setTenantCurrency(tenantSlug: string, currency: string): Promise<void> {
    await apiClient.post('/tenant/settings', { tenantSlug, currency });
  }

  // Payroll
  static async listPayrollRuns(tenantSlug: string): Promise<Array<{
    id: string;
    period: string;
    status: string;
    totalGross: number;
    totalDeductions: number;
    totalNet: number;
    anomalies: Array<{ type: string; severity: string; message: string; employeeName?: string }>;
    compliancePassed: boolean;
    createdAt: string;
  }>> {
    const response = await apiClient.get(`/hr/payroll?tenantSlug=${tenantSlug}`);
    return response.data.runs || [];
  }

  static async createPayrollRun(payload: {
    tenantSlug: string;
    period: string;
    config: {
      taxRate: number;
      pensionRate: number;
      healthInsuranceRate: number;
      transportAllowance: number;
      housingAllowance: number;
      mealAllowance: number;
    };
    entries: Array<{
      employeeId: string;
      employeeName: string;
      department?: string;
      position?: string;
      baseSalary: number;
      transportAllowance: number;
      housingAllowance: number;
      mealAllowance: number;
      bonus: number;
      tax: number;
      pension: number;
      healthInsurance: number;
      otherDeductions: number;
      totalDeductions: number;
      grossPay: number;
      netPay: number;
    }>;
    processedBy?: string;
  }): Promise<{
    runId: string;
    anomalies: Array<{ type: string; severity: string; message: string; employeeName?: string }>;
    compliance: { passed: boolean; issues: string[] };
  }> {
    const response = await apiClient.post('/hr/payroll', payload);
    return response.data;
  }

  static async getPayrollRun(tenantSlug: string, runId: string): Promise<{
    run: any;
    entries: any[];
  }> {
    const response = await apiClient.get(`/hr/payroll/${runId}?tenantSlug=${tenantSlug}`);
    return response.data;
  }

  // Payroll Adjustments
  static async listPayrollAdjustments(tenantSlug: string, opts?: {
    employeeId?: string;
    period?: string;
    status?: 'pending' | 'applied' | 'rejected';
  }): Promise<Array<{
    id: string;
    tenantSlug: string;
    employeeId: string;
    type: 'increment' | 'deduction';
    category: 'bonus' | 'promotion' | 'fine' | 'loan_repayment' | 'other';
    amount: number;
    reason: string | null;
    effectivePeriod: string;
    status: 'pending' | 'applied' | 'rejected';
    approvedBy: string | null;
    createdAt: string;
    appliedAt: string | null;
  }>> {
    const params = new URLSearchParams({ tenantSlug });
    if (opts?.employeeId) params.set('employeeId', opts.employeeId);
    if (opts?.period) params.set('period', opts.period);
    if (opts?.status) params.set('status', opts.status);
    const response = await apiClient.get(`/hr/payroll/adjustments?${params.toString()}`);
    return response.data.adjustments || [];
  }

  static async createPayrollAdjustment(payload: {
    tenantSlug: string;
    employeeId: string;
    type: 'increment' | 'deduction';
    category: 'bonus' | 'promotion' | 'fine' | 'loan_repayment' | 'other';
    amount: number;
    reason?: string;
    effectivePeriod: string;
    approvedBy?: string;
  }): Promise<{ id: string }> {
    const response = await apiClient.post('/hr/payroll/adjustments', payload);
    return response.data;
  }

  static async updatePayrollAdjustmentStatus(
    tenantSlug: string,
    id: string,
    status: 'applied' | 'rejected',
    approvedBy?: string
  ): Promise<void> {
    await apiClient.patch(`/hr/payroll/adjustments/${id}`, { status, approvedBy }, {
      headers: { 'x-tenant-slug': tenantSlug },
    });
  }

  static async deletePayrollAdjustment(tenantSlug: string, id: string): Promise<void> {
    await apiClient.delete(`/hr/payroll/adjustments/${id}`, {
      headers: { 'x-tenant-slug': tenantSlug },
    });
  }
}
