import { NextRequest, NextResponse } from 'next/server';
import { getAttendanceRecords, getTimesheetEntries } from '@/lib/persistent-storage';
import AttendanceConfidenceCalculator from '@/lib/attendance-calculator';

interface PeriodSummary {
  period: string; // e.g., "2026-02-05" for daily, "2026-W06" for weekly, "2026-02" for monthly
  periodLabel: string; // Human readable label
  totalDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  trainingDays: number;
  averageConfidence: number;
  compliancePercentage: number;
  totalHoursWorked: number;
  totalBreakTime: number;
  modeDistribution: Record<string, number>;
  records: any[];
}

interface TimePeriodConfig {
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  label: string;
  getPeriodKey: (date: Date) => string;
  getPeriodLabel: (date: Date) => string;
  getDateRange: (periodKey: string) => { start: string; end: string };
}

const TIME_PERIODS: TimePeriodConfig[] = [
  {
    type: 'daily',
    label: 'Daily',
    getPeriodKey: (date) => date.toISOString().split('T')[0],
    getPeriodLabel: (date) => date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    getDateRange: (periodKey) => ({ start: periodKey, end: periodKey })
  },
  {
    type: 'weekly',
    label: 'Weekly',
    getPeriodKey: (date) => {
      const year = date.getFullYear();
      const weekNum = Math.ceil((date.getDate() - date.getDay() + 1) / 7);
      return `${year}-W${weekNum.toString().padStart(2, '0')}`;
    },
    getPeriodLabel: (date) => {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    },
    getDateRange: (periodKey) => {
      const [year, week] = periodKey.split('-W').map(Number);
      const weekStart = new Date(year, 0, 1 + (week - 1) * 7);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return {
        start: weekStart.toISOString().split('T')[0],
        end: weekEnd.toISOString().split('T')[0]
      };
    }
  },
  {
    type: 'monthly',
    label: 'Monthly',
    getPeriodKey: (date) => `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`,
    getPeriodLabel: (date) => date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    getDateRange: (periodKey) => {
      const [year, month] = periodKey.split('-').map(Number);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      };
    }
  },
  {
    type: 'quarterly',
    label: 'Quarterly',
    getPeriodKey: (date) => {
      const year = date.getFullYear();
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `${year}-Q${quarter}`;
    },
    getPeriodLabel: (date) => {
      const year = date.getFullYear();
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      const quarterNames = ['Q1', 'Q2', 'Q3', 'Q4'];
      return `${quarterNames[quarter - 1]} ${year}`;
    },
    getDateRange: (periodKey) => {
      const [year, quarter] = periodKey.split('-Q').map(Number);
      const startMonth = (quarter - 1) * 3;
      const start = new Date(year, startMonth, 1);
      const end = new Date(year, startMonth + 3, 0);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      };
    }
  },
  {
    type: 'annual',
    label: 'Annual',
    getPeriodKey: (date) => date.getFullYear().toString(),
    getPeriodLabel: (date) => date.getFullYear().toString(),
    getDateRange: (periodKey) => {
      const year = parseInt(periodKey);
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      };
    }
  }
];

function calculatePeriodSummary(records: any[], timesheetEntries: any[], periodConfig: TimePeriodConfig, periodKey: string): PeriodSummary {
  const { start, end } = periodConfig.getDateRange(periodKey);

  // Filter records for this period
  const periodRecords = records.filter(r =>
    r.workDate >= start && r.workDate <= end
  );

  // Calculate basic metrics
  const presentDays = periodRecords.filter(r => r.attendanceStatus === 'PRESENT' || r.attendanceStatus === 'PRESENT_LOW_CONFIDENCE').length;
  const absentDays = periodRecords.filter(r => r.attendanceStatus === 'ABSENT').length;
  const leaveDays = periodRecords.filter(r => r.attendanceStatus === 'ON_LEAVE').length;
  const trainingDays = periodRecords.filter(r => r.attendanceStatus === 'TRAINING').length;

  // Calculate average confidence
  const confidenceScores = periodRecords.map(r => r.confidenceScore).filter(score => score > 0);
  const averageConfidence = confidenceScores.length > 0 ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length : 0;

  // Calculate compliance percentage
  const totalExpectedDays = periodRecords.length;
  const compliancePercentage = totalExpectedDays > 0 ? (presentDays / totalExpectedDays) * 100 : 0;

  // Calculate mode distribution
  const modeDistribution: Record<string, number> = {};
  periodRecords.forEach(record => {
    const mode = record.workMode || 'UNKNOWN';
    modeDistribution[mode] = (modeDistribution[mode] || 0) + 1;
  });

  // Calculate total hours worked and break time from timesheet
  let totalHoursWorked = 0;
  let totalBreakTime = 0;

  // Group timesheet entries by date
  const entriesByDate = timesheetEntries.reduce((acc, entry) => {
    if (!acc[entry.workDate]) acc[entry.workDate] = [];
    acc[entry.workDate].push(entry);
    return acc;
  }, {} as Record<string, any[]>);

  (Object.values(entriesByDate) as any[]).forEach((dayEntries: any[]) => {
    const sortedEntries = dayEntries.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let checkInTime: Date | null = null;
    let breakStartTime: Date | null = null;
    let dayBreakTime = 0;

    sortedEntries.forEach((entry: any) => {
      const entryTime = new Date(entry.timestamp);

      switch (entry.entryType) {
        case 'CHECK_IN':
          checkInTime = entryTime;
          break;
        case 'CHECK_OUT':
          if (checkInTime) {
            const workTime = (entryTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
            totalHoursWorked += Math.max(0, workTime - dayBreakTime);
          }
          break;
        case 'BREAK_START':
          breakStartTime = entryTime;
          break;
        case 'BREAK_END':
          if (breakStartTime) {
            dayBreakTime += (entryTime.getTime() - breakStartTime.getTime()) / (1000 * 60 * 60);
            totalBreakTime += dayBreakTime;
            breakStartTime = null;
          }
          break;
      }
    });
  });

  return {
    period: periodKey,
    periodLabel: periodConfig.getPeriodLabel(new Date(start)),
    totalDays: periodRecords.length,
    presentDays,
    absentDays,
    leaveDays,
    trainingDays,
    averageConfidence: Math.round(averageConfidence * 100) / 100,
    compliancePercentage: Math.round(compliancePercentage * 100) / 100,
    totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
    totalBreakTime: Math.round(totalBreakTime * 100) / 100,
    modeDistribution,
    records: periodRecords
  };
}

/**
 * GET /api/attendance/reports
 * Returns attendance data organized by different time periods
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tenantSlug = searchParams.get('tenantSlug');
  const employeeId = searchParams.get('employeeId');
  const periodType = searchParams.get('periodType') as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  const limit = parseInt(searchParams.get('limit') || '12');

  if (!tenantSlug) {
    return NextResponse.json({ error: 'tenantSlug required' }, { status: 400 });
  }

  if (!periodType || !TIME_PERIODS.find(p => p.type === periodType)) {
    return NextResponse.json({
      error: 'Invalid periodType. Must be one of: daily, weekly, monthly, quarterly, annual'
    }, { status: 400 });
  }

  try {
    const attendanceRecords = await getAttendanceRecords();
    const timesheetEntries = await getTimesheetEntries();

    // Filter records by tenant and employee
    let filteredRecords = attendanceRecords.filter(r => r.tenantId === tenantSlug);
    if (employeeId) {
      filteredRecords = filteredRecords.filter(r => r.employeeId === employeeId);
    }

    let filteredTimesheetEntries = timesheetEntries.filter(e => e.tenantId === tenantSlug);
    if (employeeId) {
      filteredTimesheetEntries = filteredTimesheetEntries.filter(e => e.employeeId === employeeId);
    }

    const periodConfig = TIME_PERIODS.find(p => p.type === periodType)!;

    // Group records by period
    const recordsByPeriod: Record<string, any[]> = {};
    filteredRecords.forEach(record => {
      const date = new Date(record.workDate);
      const periodKey = periodConfig.getPeriodKey(date);
      if (!recordsByPeriod[periodKey]) {
        recordsByPeriod[periodKey] = [];
      }
      recordsByPeriod[periodKey].push(record);
    });

    // Calculate summaries for each period
    const summaries: PeriodSummary[] = Object.keys(recordsByPeriod)
      .sort((a, b) => b.localeCompare(a)) // Sort by period key descending (most recent first)
      .slice(0, limit) // Limit results
      .map(periodKey => calculatePeriodSummary(
        recordsByPeriod[periodKey],
        filteredTimesheetEntries,
        periodConfig,
        periodKey
      ));

    return NextResponse.json({
      periodType,
      summaries,
      totalPeriods: Object.keys(recordsByPeriod).length
    });

  } catch (error) {
    console.error('Error generating attendance reports:', error);
    return NextResponse.json({ error: 'Failed to generate attendance reports' }, { status: 500 });
  }
}