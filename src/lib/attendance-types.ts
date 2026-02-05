// Attendance System Types and Constants

export type WorkMode = 'ONSITE' | 'REMOTE' | 'HYBRID' | 'FIELD' | 'LEAVE' | 'TRAINING';
export type SignalType = 
  | 'CHECK_IN'
  | 'CHECK_OUT'
  | 'TASK_UPDATE'
  | 'TIME_LOG'
  | 'MEETING_ATTENDED'
  | 'LMS_ACTIVITY'
  | 'MANAGER_OVERRIDE'
  | 'AVAILABILITY_CONFIRMATION';

export type AttendanceStatus = 'PRESENT' | 'PRESENT_LOW_CONFIDENCE' | 'ABSENT' | 'ON_LEAVE' | 'TRAINING';

export interface AttendanceRecord {
  id: string;
  tenantId: string;
  employeeId: string;
  departmentId?: string;
  branchId?: string;
  workDate: string; // YYYY-MM-DD
  workMode: WorkMode;
  
  confidenceScore: number; // 0-100
  attendanceStatus: AttendanceStatus;
  
  checkInTime?: string;
  checkOutTime?: string;
  shiftConfirmed: boolean;
  
  taskActivityCount: number;
  timeLoggedHours: number;
  meetingsAttended: number;
  lmsActivityScore: number;
  
  managerNotes?: string;
  isOverride: boolean;
  overrideReason?: string;
  overrideByUserId?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceSignal {
  id: string;
  tenantId: string;
  employeeId: string;
  attendanceRecordId: string;
  
  signalType: SignalType;
  signalData?: Record<string, any>;
  confidenceWeight?: number;
  
  source: 'web' | 'mobile' | 'api' | 'auto';
  sourceReferenceId?: string;
  
  createdAt: string;
}

export interface AttendancePolicy {
  id: string;
  tenantId: string;
  name: string;
  
  presentThreshold: number; // >= this = Present
  lowConfidenceThreshold: number; // >= this = Present (Low Confidence)
  
  checkInWeight: number; // 30
  taskActivityWeight: number; // 25
  timeLoggedWeight: number; // 25
  meetingsWeight: number; // 10
  trainingWeight: number; // 10
  
  defaultModeForRole?: WorkMode;
  
  requiresCheckIn: boolean;
  allowsLateCheckIn: boolean;
  lateCheckInWindowMinutes: number;
  requiresShiftConfirmation: boolean;
  requiresWeeklyAvailabilityConfirmation: boolean;
  
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceOverrideLog {
  id: string;
  tenantId: string;
  attendanceRecordId: string;
  
  overriddenByUserId: string;
  overrideTimestamp: string;
  
  previousStatus?: AttendanceStatus;
  newStatus: AttendanceStatus;
  previousConfidenceScore?: number;
  newConfidenceScore?: number;
  previousWorkMode?: WorkMode;
  newWorkMode?: WorkMode;
  
  reason: string;
  notes?: string;
  
  createdAt: string;
}

export interface AttendanceConfidenceInput {
  checkInProvided: boolean;
  taskActivityScore: number; // 0-100
  timeLoggedScore: number; // 0-100
  communicationScore: number; // 0-100
  trainingScore: number; // 0-100
}

export interface DailyAttendanceSummary {
  workDate: string;
  mode: WorkMode;
  confidenceScore: number;
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  hoursWorked?: number;
  taskCount: number;
  timeLogged: number;
  meetingsAttended: number;
  flags: string[]; // 'idle', 'overloaded', 'missing_check_in', etc.
}

export interface WeeklyAttendanceSummary {
  weekStart: string;
  weekEnd: string;
  expectedWorkingDays: number;
  activeDays: number;
  modeDistribution: Record<WorkMode, number>;
  confidenceScores: number[];
  averageConfidence: number;
  leaveBlocks: number;
  trainingDays: number;
  managerNotes?: string;
}

export interface MonthlyAttendanceSummary {
  month: string; // YYYY-MM
  totalWorkDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  trainingDays: number;
  averageConfidence: number;
  compliancePercentage: number; // (presentDays / totalWorkDays) * 100
  modeDistribution: Record<WorkMode, number>;
  payrollReady: boolean;
}

export interface AttendanceAnomalies {
  employeeId: string;
  anomalyType: 'hybrid_abuse' | 'low_contribution' | 'excessive_absences' | 'irregular_pattern';
  severity: 'low' | 'medium' | 'high';
  details: string;
  detectedDate: string;
  resolved: boolean;
}
