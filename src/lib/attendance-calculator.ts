import { AttendanceConfidenceInput, AttendanceStatus, AttendancePolicy, AttendanceRecord } from './attendance-types';

/**
 * Attendance Confidence Score Calculator
 * 
 * Calculates intelligent presence score based on multiple signals
 * instead of just binary clock in/out.
 */

export class AttendanceConfidenceCalculator {
  /**
   * Calculate Attendance Confidence Score (ACS)
   * 
   * ACS = (
   *   (checkIn ? 30 : 0) +
   *   (taskActivityScore * 25) +
   *   (timeLoggedScore * 25) +
   *   (communicationScore * 10) +
   *   (trainingScore * 10)
   * )
   */
  static calculateACS(
    input: AttendanceConfidenceInput,
    policy: AttendancePolicy
  ): number {
    const checkInScore = input.checkInProvided ? policy.checkInWeight : 0;
    const taskScore = (input.taskActivityScore / 100) * policy.taskActivityWeight;
    const timeScore = (input.timeLoggedScore / 100) * policy.timeLoggedWeight;
    const communicationScore = (input.communicationScore / 100) * policy.meetingsWeight;
    const trainingScore = (input.trainingScore / 100) * policy.trainingWeight;

    const totalScore = checkInScore + taskScore + timeScore + communicationScore + trainingScore;
    
    // Clamp to 0-100
    return Math.min(100, Math.max(0, totalScore));
  }

  /**
   * Determine attendance status based on ACS and policy thresholds
   */
  static getAttendanceStatus(
    acs: number,
    policy: AttendancePolicy,
    record: Partial<AttendanceRecord>
  ): AttendanceStatus {
    // Handle special cases first
    if (record.workMode === 'LEAVE') return 'ON_LEAVE';
    if (record.workMode === 'TRAINING') return 'TRAINING';

    // Threshold-based status
    if (acs >= policy.presentThreshold) {
      return 'PRESENT';
    } else if (acs >= policy.lowConfidenceThreshold) {
      return 'PRESENT_LOW_CONFIDENCE';
    } else {
      return 'ABSENT';
    }
  }

  /**
   * Calculate task activity score (0-100)
   * Based on number of task updates in a day
   */
  static calculateTaskActivityScore(taskCount: number): number {
    // Assume 5+ tasks = 100 points
    // Scale linearly: each task = 20 points
    return Math.min(100, (taskCount / 5) * 100);
  }

  /**
   * Calculate time logged score (0-100)
   * Based on hours logged against 8-hour workday
   */
  static calculateTimeLoggedScore(hoursLogged: number, expectedHours: number = 8): number {
    // 8 hours = 100 points
    // Less than 2 hours = 0 points
    if (hoursLogged < 2) return 0;
    return Math.min(100, (hoursLogged / expectedHours) * 100);
  }

  /**
   * Calculate communication/meeting score (0-100)
   * Based on meetings attended
   */
  static calculateMeetingScore(meetingsAttended: number): number {
    // 3+ meetings = 100 points
    // 0 meetings = 0 points
    return Math.min(100, (meetingsAttended / 3) * 100);
  }

  /**
   * Calculate LMS/training activity score (0-100)
   */
  static calculateTrainingScore(lmsActivityScore: number): number {
    // Already normalized 0-100
    return Math.min(100, Math.max(0, lmsActivityScore));
  }

  /**
   * Detect attendance anomalies
   */
  static detectAnomalies(
    employeeId: string,
    recentRecords: AttendanceRecord[],
    policy: AttendancePolicy
  ): Array<{ type: string; severity: 'low' | 'medium' | 'high'; details: string }> {
    const anomalies: Array<{ type: string; severity: 'low' | 'medium' | 'high'; details: string }> = [];

    if (recentRecords.length === 0) return anomalies;

    // Calculate statistics
    const avgConfidence = recentRecords.reduce((sum, r) => sum + r.confidenceScore, 0) / recentRecords.length;
    const lowConfidenceDays = recentRecords.filter(r => r.confidenceScore < policy.lowConfidenceThreshold).length;
    const absentDays = recentRecords.filter(r => r.attendanceStatus === 'ABSENT').length;
    const hybridDays = recentRecords.filter(r => r.workMode === 'HYBRID').length;
    const remoteDays = recentRecords.filter(r => r.workMode === 'REMOTE').length;

    // Anomaly 1: Low contribution trend
    if (avgConfidence < policy.lowConfidenceThreshold) {
      anomalies.push({
        type: 'low_contribution',
        severity: (avgConfidence < 30 ? 'high' : 'medium') as 'low' | 'medium' | 'high',
        details: `Average confidence score is ${avgConfidence.toFixed(1)}% over last ${recentRecords.length} days. May indicate low productivity or engagement issues.`
      });
    }

    // Anomaly 2: Excessive absences
    if (absentDays > recentRecords.length * 0.2) {
      anomalies.push({
        type: 'excessive_absences',
        severity: 'high' as const,
        details: `${absentDays} absent days out of ${recentRecords.length} days (${((absentDays / recentRecords.length) * 100).toFixed(0)}%).`
      });
    }

    // Anomaly 3: Hybrid abuse pattern (claiming hybrid but no actual work)
    const hybridLowContribution = recentRecords
      .filter(r => r.workMode === 'HYBRID' && r.confidenceScore < 40)
      .length;
    if (hybridLowContribution > 2) {
      anomalies.push({
        type: 'hybrid_abuse',
        severity: 'medium' as const,
        details: `${hybridLowContribution} hybrid days with low contribution (< 40 confidence). Verify actual work output.`
      });
    }

    // Anomaly 4: Irregular patterns (sudden changes)
    if (recentRecords.length >= 5) {
      const recentAvg = recentRecords.slice(-3).reduce((sum, r) => sum + r.confidenceScore, 0) / 3;
      const previousAvg = recentRecords.slice(-6, -3).reduce((sum, r) => sum + r.confidenceScore, 0) / 3;
      if (Math.abs(recentAvg - previousAvg) > 30) {
        anomalies.push({
          type: 'irregular_pattern',
          severity: 'low' as const,
          details: `Significant shift in attendance pattern. Recent avg: ${recentAvg.toFixed(1)}%, Previous avg: ${previousAvg.toFixed(1)}%.`
        });
      }
    }

    return anomalies;
  }

  /**
   * Generate daily flags for attendance record
   */
  static generateFlags(record: AttendanceRecord, policy: AttendancePolicy): string[] {
    const flags: string[] = [];

    if (!record.checkInTime) {
      flags.push('missing_check_in');
    }

    if (record.confidenceScore < policy.lowConfidenceThreshold) {
      flags.push('low_contribution');
    }

    if (record.timeLoggedHours < 2) {
      flags.push('minimal_time_logged');
    }

    if (record.taskActivityCount === 0) {
      flags.push('no_task_activity');
    }

    if (record.timeLoggedHours > 12) {
      flags.push('excessive_hours');
    }

    if (record.workMode === 'REMOTE' && record.meetingsAttended === 0 && record.taskActivityCount < 2) {
      flags.push('isolated_work_day');
    }

    return flags;
  }

  /**
   * Calculate weekly attendance summary
   */
  static calculateWeeklySummary(
    weekRecords: AttendanceRecord[]
  ): {
    expectedWorkDays: number;
    activeDays: number;
    modeDistribution: Record<string, number>;
    averageConfidence: number;
    leaveBlocks: number;
    trainingDays: number;
  } {
    const modeDistribution: Record<string, number> = {
      'ONSITE': 0,
      'REMOTE': 0,
      'HYBRID': 0,
      'FIELD': 0,
      'LEAVE': 0,
      'TRAINING': 0
    };

    weekRecords.forEach(record => {
      modeDistribution[record.workMode] = (modeDistribution[record.workMode] || 0) + 1;
    });

    const activeDays = weekRecords.filter(r => r.attendanceStatus !== 'ABSENT' && r.attendanceStatus !== 'ON_LEAVE').length;
    const averageConfidence = weekRecords.length > 0 
      ? weekRecords.reduce((sum, r) => sum + r.confidenceScore, 0) / weekRecords.length 
      : 0;

    return {
      expectedWorkDays: weekRecords.length,
      activeDays,
      modeDistribution,
      averageConfidence: parseFloat(averageConfidence.toFixed(1)),
      leaveBlocks: modeDistribution['LEAVE'] || 0,
      trainingDays: modeDistribution['TRAINING'] || 0
    };
  }

  /**
   * Calculate monthly compliance percentage for payroll
   */
  static calculateMonthlyCompliance(monthRecords: AttendanceRecord[]): {
    totalWorkDays: number;
    presentDays: number;
    absentDays: number;
    leaveDays: number;
    trainingDays: number;
    compliancePercentage: number;
  } {
    const presentDays = monthRecords.filter(r => r.attendanceStatus === 'PRESENT' || r.attendanceStatus === 'PRESENT_LOW_CONFIDENCE').length;
    const absentDays = monthRecords.filter(r => r.attendanceStatus === 'ABSENT').length;
    const leaveDays = monthRecords.filter(r => r.attendanceStatus === 'ON_LEAVE').length;
    const trainingDays = monthRecords.filter(r => r.attendanceStatus === 'TRAINING').length;
    
    const workDays = presentDays + absentDays; // Don't count leave/training as work days
    const compliancePercentage = workDays > 0 ? (presentDays / workDays) * 100 : 0;

    return {
      totalWorkDays: monthRecords.length,
      presentDays,
      absentDays,
      leaveDays,
      trainingDays,
      compliancePercentage: parseFloat(compliancePercentage.toFixed(1))
    };
  }
}

export default AttendanceConfidenceCalculator;
