export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: 'sales' | 'finance' | 'hr' | 'operations' | 'management';
  role: 'admin' | 'manager' | 'contributor' | 'viewer';
  position: string;
  avatar?: string;
  isActive: boolean;
  permissions: TeamPermissions;
  joinedAt: string;
  lastActiveAt: string;
}

export interface TeamPermissions {
  canSubmitData: boolean;
  canApproveData: boolean;
  canViewReports: boolean;
  canGenerateReports: boolean;
  canManageTeam: boolean;
  canConfigureIntegrations: boolean;
  allowedDataTypes: string[];
  allowedDepartments: string[];
}

export interface TeamDataSubmission {
  id: string;
  teamMemberId: string;
  dataType: 'sales' | 'financial' | 'hr' | 'operations' | 'custom';
  period: {
    start: string;
    end: string;
  };
  title: string;
  description: string;
  data: Record<string, any>;
  attachments?: Array<{
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
  }>;
  confidence: 'high' | 'medium' | 'low';
  source: 'manual' | 'automated' | 'imported' | 'webhook';
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  qualityScore?: number;
  validationErrors?: string[];
}

export interface DataSource {
  id: string;
  name: string;
  type: 'api' | 'database' | 'file' | 'webhook' | 'email';
  description: string;
  endpoint?: string;
  credentials?: {
    type: 'basic' | 'bearer' | 'api_key' | 'oauth';
    encrypted: string;
  };
  schedule?: {
    frequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'monthly';
    cronExpression?: string;
    timezone: string;
    lastRun?: string;
    nextRun?: string;
  };
  format: 'json' | 'csv' | 'xml' | 'excel' | 'custom';
  mappings: DataFieldMapping[];
  isActive: boolean;
  teamMemberId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DataFieldMapping {
  sourceField: string;
  targetField: string;
  transformation?: 'none' | 'uppercase' | 'lowercase' | 'date_format' | 'number_format' | 'custom';
  validation?: {
    required: boolean;
    type: 'string' | 'number' | 'date' | 'boolean';
    pattern?: string;
    min?: number;
    max?: number;
  };
}

export interface TeamWorkflow {
  id: string;
  name: string;
  description: string;
  trigger: {
    type: 'data_submission' | 'schedule' | 'manual';
    conditions?: Record<string, any>;
  };
  steps: WorkflowStep[];
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

export interface WorkflowStep {
  id: string;
  type: 'approval' | 'validation' | 'notification' | 'transformation' | 'integration';
  name: string;
  config: Record<string, any>;
  order: number;
  conditions?: Record<string, any>;
}

export interface TeamAnalytics {
  teamMemberId: string;
  period: string;
  metrics: {
    submissionsCount: number;
    approvedSubmissions: number;
    rejectedSubmissions: number;
    averageQualityScore: number;
    averageProcessingTime: number; // in hours
    dataTypesSubmitted: string[];
    lastSubmissionDate: string;
  };
  rankings?: {
    overall: number;
    department: number;
    quality: number;
    quantity: number;
  };
  trends: {
    submissionsTrend: 'up' | 'down' | 'stable';
    qualityTrend: 'up' | 'down' | 'stable';
    efficiencyTrend: 'up' | 'down' | 'stable';
  };
}

export interface DataQualityAlert {
  id: string;
  type: 'missing_data' | 'anomaly' | 'quality_drop' | 'validation_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  teamMemberId?: string;
  submissionId?: string;
  dataSourceId?: string;
  detectedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  actions: Array<{
    type: 'notify' | 'auto_fix' | 'manual_review' | 'escalate';
    executed: boolean;
    executedAt?: string;
  }>;
}

export interface TeamCollaboration {
  id: string;
  type: 'data_shared' | 'comment' | 'mention' | 'approval_request' | 'feedback';
  actorId: string;
  targetId?: string;
  targetType?: 'submission' | 'team_member' | 'report';
  content: string;
  metadata?: Record<string, any>;
  createdAt: string;
  isRead: boolean;
  readAt?: string;
}
