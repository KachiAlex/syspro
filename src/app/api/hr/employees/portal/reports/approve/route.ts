import { NextRequest, NextResponse } from "next/server";
import { decodeEmployeeToken, resolveEmployeeSession } from "@/lib/hr/auth";
import { sql as SQL } from "@/lib/sql-client";
import { ensureHrTables, insertNotification } from "@/lib/hr/db";

export async function GET(request: NextRequest) {
  const session = resolveEmployeeSession(request); if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const sql = SQL;
    const employeeRole = (session.role || "staff").toLowerCase();

    // Ensure table and columns exist (runs migrations)
    try { await ensureHrTables(sql); } catch (e) { console.error("ensureHrTables failed (non-fatal):", (e as any)?.message); }

    // Determine which reports this user can approve
    let rows: any[] = [];
    let myReports: any[] = []; // HOD's own reports pending higher-level approval

    if (employeeRole === "hod" || employeeRole === "head_of_department") {
      // HOD sees reports from staff in their department
      const empInfo = await sql`
        SELECT department_id FROM admin_employees
        WHERE id = ${session.id} AND tenant_slug = ${session.tenantSlug}
        LIMIT 1
      `;
      const deptId = empInfo[0]?.department_id;
      if (deptId) {
        try {
          rows = await sql`
            SELECT r.id, r.title, r.report_type, r.report_date, r.objectives,
                   r.achievements, r.challenges, r.next_steps, r.additional_notes,
                   r.meetings, r.blockers, r.activities, r.status, r.hod_comment,
                   r.submitted_at, r.updated_at, r.appraisal,
                   r.submitter_role, r.approver_role, r.approver_id,
                   e.name as employee_name, e.job_title as employee_job_title
            FROM admin_staff_reports r
            JOIN admin_employees e ON r.employee_id = e.id
            WHERE r.tenant_slug = ${session.tenantSlug}
              AND r.department_id = ${deptId}
              AND r.approver_role = 'hod'
              AND r.status IN ('pending', 'under_review')
            ORDER BY r.submitted_at DESC
            LIMIT 100
          `;
        } catch (e) {
          // Fallback without new columns
          try {
            rows = await sql`
              SELECT r.id, r.title, r.report_type, r.report_date, r.objectives,
                     r.achievements, r.challenges, r.next_steps, r.additional_notes,
                     r.meetings, r.blockers, r.activities, r.status, r.hod_comment,
                     r.submitted_at, r.updated_at, r.appraisal,
                     e.name as employee_name, e.job_title as employee_job_title
              FROM admin_staff_reports r
              JOIN admin_employees e ON r.employee_id = e.id
              WHERE r.tenant_slug = ${session.tenantSlug}
                AND r.department_id = ${deptId}
                AND r.status IN ('pending', 'under_review')
              ORDER BY r.submitted_at DESC
              LIMIT 100
            `;
          } catch (e2) {
            // Ultimate fallback: SELECT *
            rows = await sql`
              SELECT r.*, e.name as employee_name, e.job_title as employee_job_title
              FROM admin_staff_reports r
              JOIN admin_employees e ON r.employee_id = e.id
              WHERE r.tenant_slug = ${session.tenantSlug}
                AND r.department_id = ${deptId}
                AND r.status IN ('pending', 'under_review')
              ORDER BY r.submitted_at DESC
              LIMIT 100
            `;
          }
        }

        // Also fetch HOD's own reports that are pending HR/admin approval
        try {
          myReports = await sql`
            SELECT r.id, r.title, r.report_type, r.report_date, r.objectives,
                   r.achievements, r.challenges, r.next_steps, r.additional_notes,
                   r.meetings, r.blockers, r.activities, r.status, r.hod_comment,
                   r.submitted_at, r.updated_at, r.appraisal,
                   r.submitter_role, r.approver_role, r.approver_id
            FROM admin_staff_reports r
            WHERE r.tenant_slug = ${session.tenantSlug}
              AND r.employee_id = ${session.id}
              AND r.status IN ('pending', 'under_review', 'approved', 'needs_edit', 'rejected')
            ORDER BY r.submitted_at DESC
            LIMIT 50
          `;
        } catch (e) {
          console.error("Approve GET myReports failed:", (e as any)?.message);
        }
      }
    } else if (employeeRole === "hr" || employeeRole === "hr_admin" || employeeRole === "hr_manager") {
      try {
        rows = await sql`
          SELECT r.id, r.title, r.report_type, r.report_date, r.objectives,
                 r.achievements, r.challenges, r.next_steps, r.additional_notes,
                 r.meetings, r.blockers, r.activities, r.status, r.hod_comment,
                 r.submitted_at, r.updated_at, r.appraisal,
                 r.submitter_role, r.approver_role, r.approver_id,
                 e.name as employee_name, e.job_title as employee_job_title
          FROM admin_staff_reports r
          JOIN admin_employees e ON r.employee_id = e.id
          WHERE r.tenant_slug = ${session.tenantSlug}
            AND r.approver_role = 'hr_admin'
            AND r.status IN ('pending', 'under_review')
          ORDER BY r.submitted_at DESC
          LIMIT 100
        `;
      } catch (e) {
        // Fallback without new columns
        try {
          rows = await sql`
            SELECT r.id, r.title, r.report_type, r.report_date, r.objectives,
                   r.achievements, r.challenges, r.next_steps, r.additional_notes,
                   r.meetings, r.blockers, r.activities, r.status, r.hod_comment,
                   r.submitted_at, r.updated_at, r.appraisal,
                   e.name as employee_name, e.job_title as employee_job_title
            FROM admin_staff_reports r
            JOIN admin_employees e ON r.employee_id = e.id
            WHERE r.tenant_slug = ${session.tenantSlug}
              AND r.status IN ('pending', 'under_review')
            ORDER BY r.submitted_at DESC
            LIMIT 100
          `;
        } catch (e2) {
          rows = await sql`
            SELECT r.*, e.name as employee_name, e.job_title as employee_job_title
            FROM admin_staff_reports r
            JOIN admin_employees e ON r.employee_id = e.id
            WHERE r.tenant_slug = ${session.tenantSlug}
              AND r.status IN ('pending', 'under_review')
            ORDER BY r.submitted_at DESC
            LIMIT 100
          `;
        }
      }
    }

    return NextResponse.json({ pendingReports: rows, myReports });
  } catch (error: any) {
    console.error("Approve GET error:", error?.message);
    return NextResponse.json({ error: "Failed to load pending reports" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = resolveEmployeeSession(request); if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const sql = SQL;
    const body = await request.json();
    const { reportId, action, comment } = body;

    // Ensure table and columns exist (runs migrations)
    try { await ensureHrTables(sql); } catch (e) { console.error("ensureHrTables failed (non-fatal):", (e as any)?.message); }

    if (!reportId || !action) {
      return NextResponse.json({ error: "Missing reportId or action" }, { status: 400 });
    }

    const validActions = ["approve", "reject", "request_edit"];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const employeeRole = (session.role || "staff").toLowerCase();

    // Fetch the report to verify the user has permission to approve it
    let reports: any[] = [];
    try {
      reports = await sql`
        SELECT id, employee_id, approver_role, approver_id, department_id, status
        FROM admin_staff_reports
        WHERE id = ${reportId} AND tenant_slug = ${session.tenantSlug}
        LIMIT 1
      `;
    } catch (e) {
      // Fallback without approver_role/approver_id columns
      reports = await sql`
        SELECT id, employee_id, department_id, status
        FROM admin_staff_reports
        WHERE id = ${reportId} AND tenant_slug = ${session.tenantSlug}
        LIMIT 1
      `;
    }

    if (reports.length === 0) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const report = reports[0];

    // Permission check: only the assigned approver role can act
    const canApprove =
      (report.approver_role === "hod" && (employeeRole === "hod" || employeeRole === "head_of_department")) ||
      (report.approver_role === "hr_admin" && (employeeRole === "hr" || employeeRole === "hr_admin" || employeeRole === "hr_manager")) ||
      (report.approver_role === "tenant_admin" && (employeeRole === "admin" || employeeRole === "tenant_admin")) ||
      (!report.approver_role && (employeeRole === "hod" || employeeRole === "head_of_department")); // fallback: no approver_role column, allow HOD

    if (!canApprove) {
      return NextResponse.json({ error: "You do not have permission to act on this report" }, { status: 403 });
    }

    // For HOD approvers, also verify they're in the same department
    if (report.approver_role === "hod" && report.approver_id) {
      if (report.approver_id !== session.id) {
        return NextResponse.json({ error: "You are not the assigned approver for this report" }, { status: 403 });
      }
    }

    // Map action to status
    const statusMap: Record<string, string> = {
      approve: "approved",
      reject: "rejected",
      request_edit: "needs_edit",
    };
    const newStatus = statusMap[action];
    const shouldTimestamp = ["approved", "rejected", "needs_edit"].includes(newStatus);
    const actionAt = shouldTimestamp ? new Date().toISOString() : null;
    const rejectedAt = newStatus === "rejected" ? new Date().toISOString() : null;

    try {
      await sql`
        UPDATE admin_staff_reports
        SET
          status = ${newStatus},
          hod_comment = ${comment || null},
          hod_action_at = ${actionAt},
          rejected_at = ${rejectedAt},
          updated_at = now()
        WHERE id = ${reportId} AND tenant_slug = ${session.tenantSlug}
      `;
    } catch (e) {
      // Fallback: update without hod_action_at/rejected_at columns
      try {
        await sql`
          UPDATE admin_staff_reports
          SET
            status = ${newStatus},
            hod_comment = ${comment || null},
            updated_at = now()
          WHERE id = ${reportId} AND tenant_slug = ${session.tenantSlug}
        `;
      } catch (e2) {
        // Ultimate fallback: just update status
        await sql`
          UPDATE admin_staff_reports
          SET status = ${newStatus}
          WHERE id = ${reportId} AND tenant_slug = ${session.tenantSlug}
        `;
      }
    }

    // Notify the report submitter about the decision
    try {
      const reportEmployeeId = report.employee_id;
      if (reportEmployeeId) {
        const actionLabels: Record<string, string> = {
          approved: 'Report Approved',
          rejected: 'Report Rejected',
          needs_edit: 'Report Needs Edits',
        };
        const types: Record<string, string> = {
          approved: 'success',
          rejected: 'warning',
          needs_edit: 'warning',
        };
        await insertNotification({
          tenantSlug: session.tenantSlug,
          employeeId: reportEmployeeId,
          type: (types[newStatus] || 'info') as 'success' | 'warning' | 'info',
          category: 'hr',
          title: actionLabels[newStatus] || 'Report Update',
          message: `Your report has been ${newStatus.replace('_', ' ')} by ${session.name}${comment ? ': ' + comment : ''}`,
          actionUrl: '/employee/dashboard?tab=reports',
        });
      }
    } catch (e) { console.error('Report notification failed:', (e as any)?.message); }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error: any) {
    console.error("Approve PATCH error:", error?.message);
    return NextResponse.json({ error: "Failed to update report status" }, { status: 500 });
  }
}
