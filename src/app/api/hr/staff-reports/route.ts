import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

interface StaffReport {
  id: string;
  tenantSlug: string;
  employeeId: string;
  reportType: 'daily' | 'weekly' | 'monthly';
  reportDate: string;
  objectives: string;
  achievements: string;
  challenges: string;
  nextSteps: string;
  additionalNotes: string;
  headOfDepartment: string;
  teamMembers: string[];
  submittedAt: string;
  status: 'pending' | 'reviewed' | 'approved';
}

const STAFF_REPORTS_FILE = path.join(process.cwd(), '.data', 'staff-reports.json');

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = path.join(process.cwd(), '.data');
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Get all staff reports
async function getStaffReports(): Promise<StaffReport[]> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(STAFF_REPORTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Save staff reports
async function saveStaffReports(reports: StaffReport[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(STAFF_REPORTS_FILE, JSON.stringify(reports, null, 2));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantSlug,
      employeeId,
      reportType,
      reportDate,
      objectives,
      achievements,
      challenges,
      nextSteps,
      additionalNotes,
      headOfDepartment,
      teamMembers,
    } = body;

    // Validate required fields
    if (!tenantSlug || !employeeId || !reportType || !reportDate || !objectives || !achievements || !headOfDepartment) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const reports = await getStaffReports();

    const newReport: StaffReport = {
      id: `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tenantSlug,
      employeeId,
      reportType,
      reportDate,
      objectives,
      achievements,
      challenges,
      nextSteps,
      additionalNotes,
      headOfDepartment,
      teamMembers: teamMembers || [],
      submittedAt: new Date().toISOString(),
      status: 'pending',
    };

    reports.push(newReport);
    await saveStaffReports(reports);

    return NextResponse.json({
      success: true,
      report: newReport,
    });
  } catch (error) {
    console.error('Error submitting staff report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { reportId, status, tenantSlug } = body;

    // Validate required fields
    if (!reportId || !status || !tenantSlug) {
      return NextResponse.json(
        { error: 'Missing required fields: reportId, status, tenantSlug' },
        { status: 400 }
      );
    }

    // Validate status
    if (!['pending', 'reviewed', 'approved'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be pending, reviewed, or approved' },
        { status: 400 }
      );
    }

    const reports = await getStaffReports();

    // Find and update the report
    const reportIndex = reports.findIndex(report => report.id === reportId && report.tenantSlug === tenantSlug);

    if (reportIndex === -1) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    reports[reportIndex].status = status;
    await saveStaffReports(reports);

    return NextResponse.json({
      success: true,
      report: reports[reportIndex],
    });
  } catch (error) {
    console.error('Error updating staff report status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('tenantSlug');
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');

    if (!tenantSlug) {
      return NextResponse.json(
        { error: 'tenantSlug is required' },
        { status: 400 }
      );
    }

    const reports = await getStaffReports();

    let filteredReports = reports.filter(report => report.tenantSlug === tenantSlug);

    if (employeeId) {
      filteredReports = filteredReports.filter(report => report.employeeId === employeeId);
    }

    if (status) {
      filteredReports = filteredReports.filter(report => report.status === status);
    }

    // Sort by submission date (newest first)
    filteredReports.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    return NextResponse.json({
      reports: filteredReports,
    });
  } catch (error) {
    console.error('Error fetching staff reports:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}