import { NextRequest, NextResponse } from 'next/server';
import {
  insertStaffReport,
  listStaffReports,
  updateStaffReportStatus,
  deleteStaffReport,
} from '@/lib/hr/db';
import { AuditService } from '@/lib/tenant-admin/service';

const VALID_REPORT_TYPES = ['daily', 'weekly', 'monthly', 'quarterly'];
const VALID_STATUSES = ['pending', 'under_review', 'approved', 'needs_edit', 'rejected'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantSlug,
      employeeId,
      title,
      reportType,
      reportDate,
      rawTranscript,
      refinedText,
      objectives,
      achievements,
      challenges,
      nextSteps,
      additionalNotes,
      meetings,
      blockers,
      activities,
      headOfDepartment,
      teamMembers,
      appraisal,
      templateId,
      templateSnapshot,
      departmentId,
      resubmissionOfId,
      version,
    } = body;

    if (!tenantSlug || !employeeId || !reportType || !reportDate || !headOfDepartment) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantSlug, employeeId, reportType, reportDate, headOfDepartment' },
        { status: 400 }
      );
    }

    if (!VALID_REPORT_TYPES.includes(reportType)) {
      return NextResponse.json(
        { error: `Invalid reportType. Must be one of: ${VALID_REPORT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const report = await insertStaffReport({
      tenantSlug,
      employeeId,
      title,
      reportType,
      reportDate,
      rawTranscript,
      refinedText,
      objectives,
      achievements,
      challenges,
      nextSteps,
      additionalNotes,
      meetings,
      blockers,
      activities,
      headOfDepartment,
      teamMembers,
      appraisal,
      templateId,
      templateSnapshot,
      departmentId,
      resubmissionOfId,
      version,
    });

    try {
      const auditService = new AuditService();
      await auditService.log(
        tenantSlug as any,
        (report.employeeId ?? employeeId) as any,
        "create",
        "report",
        report.id as any,
        {
          after: {
            id: report.id,
            name: report.title || title || `${reportType} Report`,
            reportType: report.reportType || reportType,
            status: report.status || "pending",
            module: "hr",
            createdAt: report.createdAt || new Date().toISOString(),
          },
        }
      );
    } catch (auditErr) {
      console.error("Failed to audit staff report:", auditErr);
    }

    return NextResponse.json({ success: true, report });
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
    const { reportId, status, tenantSlug, hodComment } = body;

    if (!reportId || !status || !tenantSlug) {
      return NextResponse.json(
        { error: 'Missing required fields: reportId, status, tenantSlug' },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    await updateStaffReportStatus(tenantSlug, reportId, status, { hodComment });
    return NextResponse.json({ success: true });
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
    const employeeId = searchParams.get('employeeId') ?? undefined;
    const status = searchParams.get('status') ?? undefined;

    if (!tenantSlug) {
      return NextResponse.json(
        { error: 'tenantSlug is required' },
        { status: 400 }
      );
    }

    const reports = await listStaffReports(tenantSlug, { employeeId, status });
    return NextResponse.json({ reports });
  } catch (error) {
    console.error('Error fetching staff reports:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('tenantSlug');
    const reportId = searchParams.get('reportId');

    if (!tenantSlug || !reportId) {
      return NextResponse.json(
        { error: 'tenantSlug and reportId are required' },
        { status: 400 }
      );
    }

    await deleteStaffReport(tenantSlug, reportId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting staff report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
