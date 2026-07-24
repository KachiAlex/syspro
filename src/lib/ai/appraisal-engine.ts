/**
 * Unified AI Performance Appraisal Engine
 *
 * Combines deterministic metric computation with optional Groq AI analysis.
 * Falls back to deterministic-only scoring when AI is unavailable.
 * Supports configurable weights, appraisal periods, and historical trend tracking.
 */

// ─── Types ───

export type AppraisalPeriod = 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'custom';

export interface AppraisalWeights {
  kpiPerformance: number;   // 0-1
  taskExecution: number;    // 0-1
  reportQuality: number;    // 0-1
  attendance: number;       // 0-1
  consistency: number;      // 0-1
  peerFeedback: number;     // 0-1 (Phase 4)
  goalAlignment: number;    // 0-1 (Phase 4)
}

export const DEFAULT_WEIGHTS: AppraisalWeights = {
  kpiPerformance: 0.30,
  taskExecution: 0.20,
  reportQuality: 0.20,
  attendance: 0.10,
  consistency: 0.10,
  peerFeedback: 0.05,
  goalAlignment: 0.05,
};

export interface AppraisalCategoryScore {
  score: number;            // 1-100
  summary: string;
  metrics: Record<string, number | string>;
}

export interface DeterministicMetrics {
  totalTasks: number;
  totalKPIs: number;
  completedTasks: number;
  completedKPIs: number;
  pendingTasks: number;
  overdueTasks: number;
  kpiCompletionRate: number;     // 0-100
  taskCompletionRate: number;    // 0-100
  totalReports: number;
  approvedReports: number;
  pendingReports: number;
  rejectedReports: number;
  reportApprovalRate: number;    // 0-100
  reportCoverage: number;        // 0-100 (tasks addressed in reports)
  qualityScore: number;          // 0-100
  presentDays: number;
  lateDays: number;
  absentDays: number;
  attendanceRate: number;        // 0-100
  consistencyScore: number;      // 0-100
  onTimeSubmissionRate: number;  // 0-100
  avgReportLength: number;
  reportSectionFillRate: number; // 0-100
}

export interface PeerFeedbackSummary {
  totalReviews: number;
  averageRating: number;         // 1-5
  collaborationScore: number;    // 1-100
  communicationScore: number;    // 1-100
  reliabilityScore: number;      // 1-100
  topStrengths: string[];
  topImprovements: string[];
}

export interface GoalAlignmentSummary {
  totalGoals: number;
  achievedGoals: number;
  inProgressGoals: number;
  alignmentRate: number;         // 0-100
  goalCompletionRate: number;    // 0-100
}

export interface AppraisalResult {
  id?: string;
  employeeId: string;
  tenantSlug: string;
  period: AppraisalPeriod;
  periodStart: string;
  periodEnd: string;
  overallScore: number;          // 1-100
  rating: AppraisalRating;
  categories: {
    kpiPerformance: AppraisalCategoryScore;
    taskExecution: AppraisalCategoryScore;
    reportQuality: AppraisalCategoryScore;
    attendance: AppraisalCategoryScore;
    consistency: AppraisalCategoryScore;
    peerFeedback?: AppraisalCategoryScore;
    goalAlignment?: AppraisalCategoryScore;
  };
  strengths: string[];
  improvements: string[];
  recommendation: string;
  sentimentScore: number;        // -1 to 1
  anomalies: string[];
  trendDelta: number | null;     // change from previous appraisal
  previousScore: number | null;
  departmentAverage: number | null;
  percentileRank: number | null; // 0-100
  generatedBy: 'ai' | 'deterministic' | 'hybrid';
  generatedAt: string;
  weightsUsed: AppraisalWeights;
  metrics: DeterministicMetrics;
  peerFeedback?: PeerFeedbackSummary;
  goalAlignment?: GoalAlignmentSummary;
}

export type AppraisalRating =
  | 'Excellent'
  | 'Good'
  | 'Satisfactory'
  | 'Needs Improvement'
  | 'Poor';

export interface AppraisalInput {
  employee: {
    id: string;
    name: string;
    email: string;
    job_title?: string;
    role?: string;
    department_id?: string;
    hire_date?: string;
  };
  tasks: any[];
  reports: any[];
  attendance: any[];
  previousAppraisals?: AppraisalResult[];
  departmentAppraisals?: AppraisalResult[]; // peers in same department
  peerFeedback?: any[];
  goals?: any[];
  weights?: Partial<AppraisalWeights>;
  period?: AppraisalPeriod;
  periodStart?: string;
  periodEnd?: string;
  useAI?: boolean;
}

// ─── Deterministic Metric Computation ───

export function computeDeterministicMetrics(
  tasks: any[],
  reports: any[],
  attendance: any[],
): DeterministicMetrics {
  const kpiTasks = tasks.filter((t) => t.is_kpi);
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const completedKPIs = kpiTasks.filter((t) => t.status === 'completed');
  const pendingTasks = tasks.filter(
    (t) => t.status === 'pending' || t.status === 'in_progress',
  );
  const overdueTasks = tasks.filter(
    (t) =>
      t.status === 'overdue' ||
      (t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed'),
  );

  const approvedReports = reports.filter((r) => r.status === 'approved');
  const pendingReports = reports.filter(
    (r) => r.status === 'pending' || r.status === 'under_review',
  );
  const rejectedReports = reports.filter(
    (r) => r.status === 'rejected' || r.status === 'needs_edit',
  );

  const presentDays = attendance.filter((a) => a.status === 'present').length;
  const lateDays = attendance.filter((a) => a.status === 'late').length;
  const absentDays = attendance.filter((a) => a.status === 'absent').length;

  const kpiCompletionRate =
    kpiTasks.length > 0
      ? Math.round((completedKPIs.length / kpiTasks.length) * 100)
      : 0;

  const taskCompletionRate =
    tasks.length > 0
      ? Math.round((completedTasks.length / tasks.length) * 100)
      : 0;

  const reportApprovalRate =
    reports.length > 0
      ? Math.round((approvedReports.length / reports.length) * 100)
      : 0;

  const attendanceRate =
    attendance.length > 0
      ? Math.round((presentDays / attendance.length) * 100)
      : 0;

  // Report coverage: how many tasks are mentioned in report text
  const allReportText = reports
    .map((r) =>
      [
        r.objectives || '',
        r.achievements || '',
        r.challenges || '',
        r.next_steps || '',
        r.activities || '',
        r.meetings || '',
        r.blockers || '',
        r.additional_notes || '',
        r.refined_text || '',
      ].join(' '),
    )
    .join(' ');

  const addressedTasks = tasks.filter((t) =>
    isTaskMentioned(t, allReportText),
  );
  const reportCoverage =
    tasks.length > 0
      ? Math.round((addressedTasks.length / tasks.length) * 100)
      : 0;

  // Quality score: report length + section fill rate
  const sectionKeys = [
    'objectives',
    'achievements',
    'challenges',
    'next_steps',
    'activities',
    'meetings',
    'blockers',
    'additional_notes',
  ];
  let totalSections = 0;
  let filledSections = 0;
  let totalLength = 0;
  for (const r of reports) {
    for (const key of sectionKeys) {
      totalSections++;
      const val = (r as any)[key] || '';
      if (val.trim().length > 0) filledSections++;
      totalLength += val.length;
    }
  }
  const avgReportLength = reports.length > 0 ? Math.round(totalLength / reports.length) : 0;
  const reportSectionFillRate =
    totalSections > 0 ? Math.round((filledSections / totalSections) * 100) : 0;
  const lengthScore = Math.min(100, Math.round((avgReportLength / 500) * 100));
  const qualityScore = Math.round(lengthScore * 0.3 + reportSectionFillRate * 0.7);

  // Consistency: on-time submission rate
  const onTimeReports = reports.filter((r) => {
    if (!r.submitted_at || !r.report_date) return true;
    return new Date(r.submitted_at) <= new Date(r.report_date + 'T23:59:59');
  });
  const onTimeSubmissionRate =
    reports.length > 0
      ? Math.round((onTimeReports.length / reports.length) * 100)
      : 100;

  const consistencyScore = Math.round(
    onTimeSubmissionRate * 0.6 + reportApprovalRate * 0.4,
  );

  return {
    totalTasks: tasks.length,
    totalKPIs: kpiTasks.length,
    completedTasks: completedTasks.length,
    completedKPIs: completedKPIs.length,
    pendingTasks: pendingTasks.length,
    overdueTasks: overdueTasks.length,
    kpiCompletionRate,
    taskCompletionRate,
    totalReports: reports.length,
    approvedReports: approvedReports.length,
    pendingReports: pendingReports.length,
    rejectedReports: rejectedReports.length,
    reportApprovalRate,
    reportCoverage,
    qualityScore,
    presentDays,
    lateDays,
    absentDays,
    attendanceRate,
    consistencyScore,
    onTimeSubmissionRate,
    avgReportLength,
    reportSectionFillRate,
  };
}

// ─── Task Mention Detection (from report-refiner.ts, improved) ───

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractKeywords(text: string): string[] {
  return normalizeText(text)
    .split(' ')
    .filter((w) => w.length > 3);
}

function isTaskMentioned(task: any, reportText: string): boolean {
  const normalizedReport = normalizeText(reportText);
  const titleKeywords = extractKeywords(task.title || '');
  const descKeywords = extractKeywords(task.description || '');
  const outcomeKeywords = extractKeywords(task.expected_outcome || '');
  const allKeywords = [...new Set([...titleKeywords, ...descKeywords, ...outcomeKeywords])];
  if (allKeywords.length === 0) return false;
  const matched = allKeywords.filter((kw) => normalizedReport.includes(kw));
  return matched.length / allKeywords.length >= 0.35;
}

// ─── Weight Normalization ───

function normalizeWeights(weights: Partial<AppraisalWeights>): AppraisalWeights {
  const merged = { ...DEFAULT_WEIGHTS, ...weights };
  const sum = Object.values(merged).reduce((s, v) => s + v, 0);
  if (sum === 0) return DEFAULT_WEIGHTS;
  const normalized: AppraisalWeights = {} as AppraisalWeights;
  for (const key of Object.keys(merged) as (keyof AppraisalWeights)[]) {
    normalized[key] = merged[key] / sum;
  }
  return normalized;
}

// ─── Rating Computation ───

export function scoreToRating(score: number): AppraisalRating {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Satisfactory';
  if (score >= 40) return 'Needs Improvement';
  return 'Poor';
}

// ─── Deterministic Appraisal (fallback / base layer) ───

export function computeDeterministicAppraisal(
  input: AppraisalInput,
): AppraisalResult {
  const metrics = computeDeterministicMetrics(
    input.tasks,
    input.reports,
    input.attendance,
  );
  const weights = normalizeWeights(input.weights || {});

  const kpiScore = metrics.kpiCompletionRate;
  const taskScore = metrics.taskCompletionRate;
  const reportScore = Math.round(
    metrics.reportApprovalRate * 0.4 +
    metrics.qualityScore * 0.3 +
    metrics.reportCoverage * 0.3,
  );
  const attendanceScore = metrics.attendanceRate;
  const consistencyScore = metrics.consistencyScore;

  const overallScore = Math.round(
    kpiScore * weights.kpiPerformance +
    taskScore * weights.taskExecution +
    reportScore * weights.reportQuality +
    attendanceScore * weights.attendance +
    consistencyScore * weights.consistency +
    (input.peerFeedback ? computePeerFeedbackScore(input.peerFeedback) * weights.peerFeedback : 0) +
    (input.goals ? computeGoalAlignmentScore(input.goals) * weights.goalAlignment : 0),
  );

  const rating = scoreToRating(overallScore);
  const previousScore = input.previousAppraisals && input.previousAppraisals.length > 0
    ? input.previousAppraisals[0].overallScore
    : null;
  const trendDelta = previousScore !== null ? overallScore - previousScore : null;

  const deptAvg = input.departmentAppraisals && input.departmentAppraisals.length > 0
    ? Math.round(
        input.departmentAppraisals.reduce((s, a) => s + a.overallScore, 0) /
          input.departmentAppraisals.length,
      )
    : null;
  const percentileRank = deptAvg !== null && input.departmentAppraisals
    ? Math.round(
        (input.departmentAppraisals.filter((a) => a.overallScore <= overallScore).length /
          input.departmentAppraisals.length) *
          100,
      )
    : null;

  const strengths = computeStrengths(metrics);
  const improvements = computeImprovements(metrics);
  const anomalies = detectAnomalies(metrics, input.previousAppraisals || []);
  const sentimentScore = computeSentiment(input.reports);

  return {
    employeeId: input.employee.id,
    tenantSlug: '',
    period: input.period || 'monthly',
    periodStart: input.periodStart || new Date(Date.now() - 30 * 86400000).toISOString(),
    periodEnd: input.periodEnd || new Date().toISOString(),
    overallScore,
    rating,
    categories: {
      kpiPerformance: {
        score: kpiScore,
        summary: buildKPISummary(metrics),
        metrics: {
          totalKPIs: metrics.totalKPIs,
          completedKPIs: metrics.completedKPIs,
          kpiCompletionRate: metrics.kpiCompletionRate,
        },
      },
      taskExecution: {
        score: taskScore,
        summary: buildTaskSummary(metrics),
        metrics: {
          totalTasks: metrics.totalTasks,
          completedTasks: metrics.completedTasks,
          pendingTasks: metrics.pendingTasks,
          overdueTasks: metrics.overdueTasks,
        },
      },
      reportQuality: {
        score: reportScore,
        summary: buildReportSummary(metrics),
        metrics: {
          totalReports: metrics.totalReports,
          approvedReports: metrics.approvedReports,
          reportApprovalRate: metrics.reportApprovalRate,
          qualityScore: metrics.qualityScore,
          reportCoverage: metrics.reportCoverage,
        },
      },
      attendance: {
        score: attendanceScore,
        summary: buildAttendanceSummary(metrics),
        metrics: {
          presentDays: metrics.presentDays,
          lateDays: metrics.lateDays,
          absentDays: metrics.absentDays,
          attendanceRate: metrics.attendanceRate,
        },
      },
      consistency: {
        score: consistencyScore,
        summary: buildConsistencySummary(metrics),
        metrics: {
          onTimeSubmissionRate: metrics.onTimeSubmissionRate,
          reportApprovalRate: metrics.reportApprovalRate,
        },
      },
    },
    strengths,
    improvements,
    recommendation: buildRecommendation(overallScore, rating, metrics, improvements),
    sentimentScore,
    anomalies,
    trendDelta,
    previousScore,
    departmentAverage: deptAvg,
    percentileRank,
    generatedBy: 'deterministic',
    generatedAt: new Date().toISOString(),
    weightsUsed: weights,
    metrics,
  };
}

// ─── Summary Builders ───

function buildKPISummary(m: DeterministicMetrics): string {
  if (m.totalKPIs === 0) return 'No KPIs assigned for this period.';
  return `${m.completedKPIs} of ${m.totalKPIs} KPIs completed (${m.kpiCompletionRate}%). ${
    m.kpiCompletionRate >= 80 ? 'Strong KPI performance.' :
    m.kpiCompletionRate >= 50 ? 'Moderate KPI performance with room for improvement.' :
    'KPI performance needs significant improvement.'
  }`;
}

function buildTaskSummary(m: DeterministicMetrics): string {
  return `${m.completedTasks} of ${m.totalTasks} tasks completed (${m.taskCompletionRate}%). ${
    m.overdueTasks > 0 ? `${m.overdueTasks} overdue task(s).` : ''
  } ${m.pendingTasks > 0 ? `${m.pendingTasks} pending/in-progress.` : ''}`.trim();
}

function buildReportSummary(m: DeterministicMetrics): string {
  if (m.totalReports === 0) return 'No reports submitted this period.';
  return `${m.totalReports} reports submitted. ${m.approvedReports} approved (${m.reportApprovalRate}%), ${m.rejectedReports} rejected. Coverage: ${m.reportCoverage}%, Quality: ${m.qualityScore}%.`;
}

function buildAttendanceSummary(m: DeterministicMetrics): string {
  if (m.presentDays + m.lateDays + m.absentDays === 0) return 'No attendance data for this period.';
  return `Present ${m.presentDays} days, late ${m.lateDays}, absent ${m.absentDays}. Attendance rate: ${m.attendanceRate}%.`;
}

function buildConsistencySummary(m: DeterministicMetrics): string {
  return `On-time submission: ${m.onTimeSubmissionRate}%. Report approval rate: ${m.reportApprovalRate}%. Section fill rate: ${m.reportSectionFillRate}%.`;
}

function buildRecommendation(
  score: number,
  rating: AppraisalRating,
  m: DeterministicMetrics,
  improvements: string[],
): string {
  let rec = `Overall performance is rated "${rating}" with a score of ${score}/100. `;
  if (m.overdueTasks > 0) {
    rec += `Address ${m.overdueTasks} overdue task(s) as a priority. `;
  }
  if (m.reportCoverage < 60 && m.totalTasks > 0) {
    rec += `Report coverage is low (${m.reportCoverage}%) — ensure all assigned tasks are addressed in reports. `;
  }
  if (m.attendanceRate < 80 && (m.presentDays + m.lateDays + m.absentDays) > 0) {
    rec += `Attendance rate (${m.attendanceRate}%) needs improvement. `;
  }
  if (improvements.length > 0) {
    rec += `Key areas to focus on: ${improvements.slice(0, 3).join(', ')}.`;
  }
  return rec;
}

function computeStrengths(m: DeterministicMetrics): string[] {
  const strengths: string[] = [];
  if (m.kpiCompletionRate >= 80 && m.totalKPIs > 0)
    strengths.push(`High KPI completion rate (${m.kpiCompletionRate}%)`);
  if (m.taskCompletionRate >= 80 && m.totalTasks > 0)
    strengths.push(`Strong task execution (${m.taskCompletionRate}% completed)`);
  if (m.reportApprovalRate >= 80 && m.totalReports > 0)
    strengths.push(`Excellent report quality (${m.reportApprovalRate}% approval rate)`);
  if (m.attendanceRate >= 90 && (m.presentDays + m.lateDays + m.absentDays) > 0)
    strengths.push(`Excellent attendance (${m.attendanceRate}%)`);
  if (m.onTimeSubmissionRate >= 90 && m.totalReports > 0)
    strengths.push(`Consistent on-time report submission (${m.onTimeSubmissionRate}%)`);
  if (m.reportCoverage >= 80 && m.totalTasks > 0)
    strengths.push(`Comprehensive report coverage (${m.reportCoverage}%)`);
  if (m.overdueTasks === 0 && m.totalTasks > 0)
    strengths.push('No overdue tasks');
  if (strengths.length === 0)
    strengths.push('Consistent engagement with assigned responsibilities');
  return strengths.slice(0, 5);
}

function computeImprovements(m: DeterministicMetrics): string[] {
  const improvements: string[] = [];
  if (m.kpiCompletionRate < 60 && m.totalKPIs > 0)
    improvements.push(`Improve KPI completion (currently ${m.kpiCompletionRate}%)`);
  if (m.taskCompletionRate < 60 && m.totalTasks > 0)
    improvements.push(`Increase task completion rate (currently ${m.taskCompletionRate}%)`);
  if (m.overdueTasks > 0)
    improvements.push(`Clear ${m.overdueTasks} overdue task(s)`);
  if (m.reportApprovalRate < 60 && m.totalReports > 0)
    improvements.push(`Improve report quality (approval rate: ${m.reportApprovalRate}%)`);
  if (m.reportCoverage < 60 && m.totalTasks > 0)
    improvements.push(`Address more tasks in reports (coverage: ${m.reportCoverage}%)`);
  if (m.attendanceRate < 80 && (m.presentDays + m.lateDays + m.absentDays) > 0)
    improvements.push(`Improve attendance (currently ${m.attendanceRate}%)`);
  if (m.onTimeSubmissionRate < 80 && m.totalReports > 0)
    improvements.push(`Submit reports on time (currently ${m.onTimeSubmissionRate}%)`);
  if (m.reportSectionFillRate < 50 && m.totalReports > 0)
    improvements.push(`Fill out more report sections (currently ${m.reportSectionFillRate}%)`);
  if (improvements.length === 0)
    improvements.push('Maintain current performance levels and seek growth opportunities');
  return improvements.slice(0, 5);
}

// ─── Anomaly Detection ───

function detectAnomalies(m: DeterministicMetrics, previous: AppraisalResult[]): string[] {
  const anomalies: string[] = [];
  if (previous.length > 0) {
    const prev = previous[0];
    if (prev.metrics.taskCompletionRate - m.taskCompletionRate > 25)
      anomalies.push(`Task completion dropped ${prev.metrics.taskCompletionRate - m.taskCompletionRate}% from last period`);
    if (prev.metrics.reportApprovalRate - m.reportApprovalRate > 25)
      anomalies.push(`Report approval rate dropped ${prev.metrics.reportApprovalRate - m.reportApprovalRate}% from last period`);
    if (prev.metrics.attendanceRate - m.attendanceRate > 20 && (m.presentDays + m.lateDays + m.absentDays) > 0)
      anomalies.push(`Attendance rate dropped ${prev.metrics.attendanceRate - m.attendanceRate}% from last period`);
    if (m.overdueTasks > prev.metrics.overdueTasks + 3)
      anomalies.push(`Overdue tasks increased from ${prev.metrics.overdueTasks} to ${m.overdueTasks}`);
  }
  if (m.absentDays > 5)
    anomalies.push(`High absence count (${m.absentDays} days in period)`);
  if (m.rejectedReports > m.approvedReports && m.totalReports > 2)
    anomalies.push(`More reports rejected (${m.rejectedReports}) than approved (${m.approvedReports})`);
  return anomalies;
}

// ─── Sentiment Analysis (simple heuristic) ───

function computeSentiment(reports: any[]): number {
  const positiveWords = ['achieved', 'completed', 'success', 'delivered', 'improved', 'exceeded', 'accomplished', 'resolved', 'launched', 'shipped'];
  const negativeWords = ['blocked', 'stuck', 'failed', 'delayed', 'missed', 'struggled', 'issue', 'problem', 'challenge', 'overdue'];
  let positive = 0;
  let negative = 0;
  for (const r of reports) {
    const text = normalizeText(
      [r.objectives || '', r.achievements || '', r.challenges || '', r.activities || '', r.next_steps || ''].join(' '),
    );
    for (const w of positiveWords) if (text.includes(w)) positive++;
    for (const w of negativeWords) if (text.includes(w)) negative++;
  }
  const total = positive + negative;
  if (total === 0) return 0;
  return (positive - negative) / total;
}

// ─── Peer Feedback Scoring (Phase 4) ───

function computePeerFeedbackScore(feedback: any[]): number {
  if (feedback.length === 0) return 0;
  const avgRating = feedback.reduce((s, f) => s + (f.rating || 3), 0) / feedback.length;
  return Math.round((avgRating / 5) * 100);
}

function summarizePeerFeedback(feedback: any[]): PeerFeedbackSummary | undefined {
  if (feedback.length === 0) return undefined;
  const avgRating = feedback.reduce((s, f) => s + (f.rating || 3), 0) / feedback.length;
  const collaborationScores = feedback.map((f) => f.collaboration_score || avgRating);
  const communicationScores = feedback.map((f) => f.communication_score || avgRating);
  const reliabilityScores = feedback.map((f) => f.reliability_score || avgRating);
  const avg = (arr: number[]) => Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);
  const strengths = feedback.flatMap((f) => f.strengths || []).filter(Boolean);
  const improvements = feedback.flatMap((f) => f.improvements || []).filter(Boolean);
  return {
    totalReviews: feedback.length,
    averageRating: Math.round(avgRating * 10) / 10,
    collaborationScore: avg(collaborationScores),
    communicationScore: avg(communicationScores),
    reliabilityScore: avg(reliabilityScores),
    topStrengths: [...new Set(strengths)].slice(0, 3),
    topImprovements: [...new Set(improvements)].slice(0, 3),
  };
}

// ─── Goal Alignment Scoring (Phase 4) ───

function computeGoalAlignmentScore(goals: any[]): number {
  if (goals.length === 0) return 0;
  const achieved = goals.filter((g) => g.status === 'achieved' || g.status === 'completed');
  const inProgress = goals.filter((g) => g.status === 'in_progress' || g.status === 'on_track');
  const achievementRate = (achieved.length / goals.length) * 60;
  const progressRate = (inProgress.length / goals.length) * 40;
  return Math.round(achievementRate + progressRate);
}

function summarizeGoalAlignment(goals: any[]): GoalAlignmentSummary | undefined {
  if (goals.length === 0) return undefined;
  const achieved = goals.filter((g) => g.status === 'achieved' || g.status === 'completed');
  const inProgress = goals.filter((g) => g.status === 'in_progress' || g.status === 'on_track');
  return {
    totalGoals: goals.length,
    achievedGoals: achieved.length,
    inProgressGoals: inProgress.length,
    alignmentRate: Math.round((inProgress.length / goals.length) * 100),
    goalCompletionRate: Math.round((achieved.length / goals.length) * 100),
  };
}

// ─── AI-Enhanced Appraisal (Groq) ───

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

export async function computeAIAppraisal(
  input: AppraisalInput,
  groqKey: string,
): Promise<AppraisalResult> {
  const deterministic = computeDeterministicAppraisal(input);
  const metrics = deterministic.metrics;

  const systemPrompt = `You are an expert HR performance analyst. Generate a comprehensive, fair, data-driven productivity appraisal based on pre-computed metrics and raw context.

Return a JSON object with this exact structure:
{
  "overallScore": <number 1-100>,
  "categories": {
    "kpiPerformance": { "score": <1-100>, "summary": "<2-3 sentences with specific data>" },
    "taskExecution": { "score": <1-100>, "summary": "<2-3 sentences>" },
    "reportQuality": { "score": <1-100>, "summary": "<2-3 sentences>" },
    "attendance": { "score": <1-100>, "summary": "<2-3 sentences>" },
    "consistency": { "score": <1-100>, "summary": "<2-3 sentences>" }
  },
  "strengths": ["<specific strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": ["<specific actionable area 1>", "<area 2>", "<area 3>"],
  "recommendation": "<1 paragraph with actionable, specific recommendations>",
  "rating": "<one of: Excellent | Good | Satisfactory | Needs Improvement | Poor>",
  "sentimentScore": <number -1 to 1>
}

Rules:
- Use the pre-computed metrics as the foundation. Adjust scores by ±10 at most based on qualitative context.
- Be specific — reference actual numbers, task names, and report content.
- Be fair and constructive — not punitive.
- The overallScore should be a weighted average of category scores.
- If a category has no data (e.g., no KPIs), give it a neutral score of 50.`;

  const kpiDetails = input.tasks
    .filter((t) => t.is_kpi)
    .slice(0, 10)
    .map(
      (t, i) =>
        `${i + 1}. ${t.title} (Weight: ${t.weight || 1}, Status: ${t.status}, Due: ${t.due_date || 'N/A'})${t.expected_outcome ? ` — Expected: ${t.expected_outcome}` : ''}${t.completion_note ? ` — Note: ${t.completion_note}` : ''}`,
    )
    .join('\n');

  const reportDetails = input.reports
    .slice(0, 5)
    .map(
      (r, i) =>
        `${i + 1}. ${r.title || r.report_type + ' report'} (${r.report_type}, ${r.report_date}) — Status: ${r.status}
   Objectives: ${(r.objectives || '').substring(0, 200)}
   Achievements: ${(r.achievements || '').substring(0, 200)}`,
    )
    .join('\n');

  const userPrompt = `Employee: ${input.employee.name} (${input.employee.job_title || 'Staff'})
Role: ${input.employee.role || 'N/A'}
Hire Date: ${input.employee.hire_date || 'N/A'}
Period: ${deterministic.period} (${deterministic.periodStart.split('T')[0]} to ${deterministic.periodEnd.split('T')[0]})

PRE-COMPUTED METRICS:
- Total Tasks: ${metrics.totalTasks} | Completed: ${metrics.completedTasks} (${metrics.taskCompletionRate}%) | Pending: ${metrics.pendingTasks} | Overdue: ${metrics.overdueTasks}
- Total KPIs: ${metrics.totalKPIs} | Completed KPIs: ${metrics.completedKPIs} (${metrics.kpiCompletionRate}%)
- Total Reports: ${metrics.totalReports} | Approved: ${metrics.approvedReports} (${metrics.reportApprovalRate}%) | Rejected: ${metrics.rejectedReports}
- Report Coverage: ${metrics.reportCoverage}% | Quality Score: ${metrics.qualityScore}% | Section Fill: ${metrics.reportSectionFillRate}%
- Attendance: Present ${metrics.presentDays}d, Late ${metrics.lateDays}d, Absent ${metrics.absentDays}d (Rate: ${metrics.attendanceRate}%)
- On-time Submission: ${metrics.onTimeSubmissionRate}% | Consistency: ${metrics.consistencyScore}%
${deterministic.previousScore !== null ? `- Previous Period Score: ${deterministic.previousScore} (Trend: ${deterministic.trendDelta! > 0 ? '+' : ''}${deterministic.trendDelta})` : ''}
${deterministic.departmentAverage !== null ? `- Department Average: ${deterministic.departmentAverage} | Percentile Rank: ${deterministic.percentileRank}%` : ''}

KPI DETAILS:
${kpiDetails || 'No KPIs assigned.'}

RECENT REPORT SUMMARIES:
${reportDetails || 'No reports submitted.'}

${input.peerFeedback && input.peerFeedback.length > 0 ? `PEER FEEDBACK:\n${input.peerFeedback.length} reviews received. Average rating: ${(input.peerFeedback.reduce((s, f) => s + (f.rating || 3), 0) / input.peerFeedback.length).toFixed(1)}/5\n` : ''}
${input.goals && input.goals.length > 0 ? `GOALS/OKRs:\n${input.goals.length} goals tracked. ${input.goals.filter((g) => g.status === 'achieved' || g.status === 'completed').length} achieved.\n` : ''}

Generate the appraisal now. Return ONLY the JSON object.`;

  try {
    const aiRes = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      console.error('Groq API error:', aiRes.status);
      return deterministic;
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) return deterministic;

    let aiResult: any;
    try {
      aiResult = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          aiResult = JSON.parse(match[0]);
        } catch {
          return deterministic;
        }
      } else {
        return deterministic;
      }
    }

    // Merge AI results with deterministic base
    const weights = deterministic.weightsUsed;
    const aiCategories = aiResult.categories || {};
    const kpiScore = aiCategories.kpiPerformance?.score ?? deterministic.categories.kpiPerformance.score;
    const taskScore = aiCategories.taskExecution?.score ?? deterministic.categories.taskExecution.score;
    const reportScore = aiCategories.reportQuality?.score ?? deterministic.categories.reportQuality.score;
    const attendanceScore = aiCategories.attendance?.score ?? deterministic.categories.attendance.score;
    const consistencyScore = aiCategories.consistency?.score ?? deterministic.categories.consistency.score;

    const peerScore = input.peerFeedback ? computePeerFeedbackScore(input.peerFeedback) : 0;
    const goalScore = input.goals ? computeGoalAlignmentScore(input.goals) : 0;

    const overallScore = Math.round(
      kpiScore * weights.kpiPerformance +
      taskScore * weights.taskExecution +
      reportScore * weights.reportQuality +
      attendanceScore * weights.attendance +
      consistencyScore * weights.consistency +
      peerScore * weights.peerFeedback +
      goalScore * weights.goalAlignment,
    );

    return {
      ...deterministic,
      overallScore,
      rating: aiResult.rating || scoreToRating(overallScore),
      categories: {
        kpiPerformance: {
          score: kpiScore,
          summary: aiCategories.kpiPerformance?.summary || deterministic.categories.kpiPerformance.summary,
          metrics: deterministic.categories.kpiPerformance.metrics,
        },
        taskExecution: {
          score: taskScore,
          summary: aiCategories.taskExecution?.summary || deterministic.categories.taskExecution.summary,
          metrics: deterministic.categories.taskExecution.metrics,
        },
        reportQuality: {
          score: reportScore,
          summary: aiCategories.reportQuality?.summary || deterministic.categories.reportQuality.summary,
          metrics: deterministic.categories.reportQuality.metrics,
        },
        attendance: {
          score: attendanceScore,
          summary: aiCategories.attendance?.summary || deterministic.categories.attendance.summary,
          metrics: deterministic.categories.attendance.metrics,
        },
        consistency: {
          score: consistencyScore,
          summary: aiCategories.consistency?.summary || deterministic.categories.consistency.summary,
          metrics: deterministic.categories.consistency.metrics,
        },
        ...(input.peerFeedback && input.peerFeedback.length > 0 ? {
          peerFeedback: {
            score: peerScore,
            summary: `Based on ${input.peerFeedback.length} peer review(s). Average rating: ${(input.peerFeedback.reduce((s, f) => s + (f.rating || 3), 0) / input.peerFeedback.length).toFixed(1)}/5`,
            metrics: { totalReviews: input.peerFeedback.length },
          },
        } : {}),
        ...(input.goals && input.goals.length > 0 ? {
          goalAlignment: {
            score: goalScore,
            summary: `${input.goals.filter((g) => g.status === 'achieved' || g.status === 'completed').length} of ${input.goals.length} goals achieved.`,
            metrics: { totalGoals: input.goals.length },
          },
        } : {}),
      },
      strengths: Array.isArray(aiResult.strengths) ? aiResult.strengths : deterministic.strengths,
      improvements: Array.isArray(aiResult.improvements) ? aiResult.improvements : deterministic.improvements,
      recommendation: aiResult.recommendation || deterministic.recommendation,
      sentimentScore: typeof aiResult.sentimentScore === 'number' ? aiResult.sentimentScore : deterministic.sentimentScore,
      generatedBy: 'hybrid',
      peerFeedback: summarizePeerFeedback(input.peerFeedback || []),
      goalAlignment: summarizeGoalAlignment(input.goals || []),
    };
  } catch (error) {
    console.error('AI appraisal failed, using deterministic fallback:', error);
    return deterministic;
  }
}

// ─── Main Entry Point ───

export async function generateAppraisal(
  input: AppraisalInput,
  groqKey?: string,
): Promise<AppraisalResult> {
  // Always compute deterministic base first
  if (!groqKey || input.useAI === false) {
    return computeDeterministicAppraisal(input);
  }
  return computeAIAppraisal(input, groqKey);
}
