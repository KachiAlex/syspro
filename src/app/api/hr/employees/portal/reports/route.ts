import { NextRequest, NextResponse } from "next/server";
import { decodeEmployeeToken, resolveEmployeeSession } from "@/lib/hr/auth";
import { sql as SQL } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import { randomUUID } from "crypto";
import { z } from "zod";

const reportSchema = z.object({
  reportType: z.enum(["daily", "weekly", "monthly", "quarterly", "annual"]),
  reportDate: z.string().min(1),
  title: z.string().optional(),
  objectives: z.string().min(1),
  achievements: z.string().min(1),
  challenges: z.string().optional().default(""),
  nextSteps: z.string().optional().default(""),
  additionalNotes: z.string().optional().default(""),
  meetings: z.string().optional().default(""),
  blockers: z.string().optional().default(""),
  activities: z.string().optional().default(""),
  teamMembers: z.array(z.string()).optional().default([]),
  kpiMetrics: z.array(z.object({
    kpiId: z.string().optional(),
    name: z.string(),
    target: z.string().optional(),
    actual: z.string().optional(),
    unit: z.string().optional(),
    status: z.enum(["on_track", "ahead", "behind", "not_started"]).optional(),
  })).optional().default([]),
});

export async function GET(request: NextRequest) {
  const session = resolveEmployeeSession(request); if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const sql = SQL;
    const url = new URL(request.url);
    const reportType = url.searchParams.get("type");

    // Ensure table and columns exist (runs migrations)
    try { await ensureHrTables(sql); } catch (e) { console.error("ensureHrTables failed (non-fatal):", (e as any)?.message); }

    let rows: any[] = [];
    try {
      if (reportType) {
        rows = await sql`
          SELECT id, title, report_type, report_date, objectives, achievements,
                 challenges, next_steps, additional_notes, meetings, blockers,
                 activities, status, hod_comment, submitted_at, updated_at, appraisal,
                 head_of_department, submitter_role, approver_role
          FROM admin_staff_reports
          WHERE tenant_slug = ${session.tenantSlug}
            AND employee_id = ${session.id}
            AND report_type = ${reportType}
          ORDER BY submitted_at DESC
          LIMIT 50
        `;
      } else {
        rows = await sql`
          SELECT id, title, report_type, report_date, objectives, achievements,
                 challenges, next_steps, additional_notes, meetings, blockers,
                 activities, status, hod_comment, submitted_at, updated_at, appraisal,
                 head_of_department, submitter_role, approver_role
          FROM admin_staff_reports
          WHERE tenant_slug = ${session.tenantSlug}
            AND employee_id = ${session.id}
          ORDER BY submitted_at DESC
          LIMIT 50
        `;
      }
    } catch (e) {
      console.error("reports: fetch with new columns failed:", (e as any)?.message);
      // Fallback without submitter_role/approver_role columns (may not exist yet)
      try {
        if (reportType) {
          rows = await sql`
            SELECT id, title, report_type, report_date, objectives, achievements,
                   challenges, next_steps, additional_notes, meetings, blockers,
                   activities, status, hod_comment, submitted_at, updated_at, appraisal,
                   head_of_department
            FROM admin_staff_reports
            WHERE tenant_slug = ${session.tenantSlug}
              AND employee_id = ${session.id}
              AND report_type = ${reportType}
            ORDER BY submitted_at DESC
            LIMIT 50
          `;
        } else {
          rows = await sql`
            SELECT id, title, report_type, report_date, objectives, achievements,
                   challenges, next_steps, additional_notes, meetings, blockers,
                   activities, status, hod_comment, submitted_at, updated_at, appraisal,
                   head_of_department
            FROM admin_staff_reports
            WHERE tenant_slug = ${session.tenantSlug}
              AND employee_id = ${session.id}
            ORDER BY submitted_at DESC
            LIMIT 50
          `;
        }
      } catch (e2) {
        console.error("reports: fallback fetch failed:", (e2 as any)?.message);
        // Third fallback: select only essential columns
        try {
          rows = await sql`
            SELECT id, title, report_type, report_date, objectives, achievements,
                   challenges, next_steps, additional_notes, status,
                   submitted_at, updated_at, head_of_department
            FROM admin_staff_reports
            WHERE tenant_slug = ${session.tenantSlug}
              AND employee_id = ${session.id}
            ORDER BY submitted_at DESC
            LIMIT 50
          `;
        } catch (e3) {
          console.error("reports: minimal fetch failed:", (e3 as any)?.message);
          // Ultimate fallback: SELECT * 
          try {
            rows = await sql`
              SELECT * FROM admin_staff_reports
              WHERE tenant_slug = ${session.tenantSlug}
                AND employee_id = ${session.id}
              ORDER BY submitted_at DESC
              LIMIT 50
            `;
          } catch (e4) {
            console.error("reports: SELECT * fallback failed:", (e4 as any)?.message);
          }
        }
      }
    }

    // Fetch KPI tasks — try with is_kpi column, fallback without
    let kpiTasks: any[] = [];
    try {
      kpiTasks = await sql`
        SELECT id, title, description, expected_outcome, weight, is_kpi, frequency,
               due_date, status, assigned_by
        FROM admin_staff_tasks
        WHERE tenant_slug = ${session.tenantSlug}
          AND employee_id = ${session.id}
          AND is_kpi = true
        ORDER BY created_at DESC
      `;
    } catch (e) {
      console.error("reports: kpiTasks with is_kpi failed:", (e as any)?.message);
      try {
        kpiTasks = await sql`
          SELECT id, title, description, frequency, due_date, status, assigned_by
          FROM admin_staff_tasks
          WHERE tenant_slug = ${session.tenantSlug}
            AND employee_id = ${session.id}
          ORDER BY created_at DESC
        `;
      } catch (e2) { console.error("reports: kpiTasks fallback failed:", (e2 as any)?.message); }
    }

    return NextResponse.json({ reports: rows, kpis: kpiTasks });
  } catch (error: any) {
    console.error("Employee reports fetch error:", error?.message || error);
    return NextResponse.json({ error: "Failed to load reports", detail: error?.message || String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = resolveEmployeeSession(request); if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const sql = SQL;

    // Ensure table and columns exist (runs migrations)
    try { await ensureHrTables(sql); } catch (e) { console.error("ensureHrTables failed (non-fatal):", (e as any)?.message); }

    const body = await request.json();
    const parsed = reportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const id = randomUUID();

    // Get employee's department, role, and HOD info
    const empInfo = await sql`
      SELECT department_id, role, name FROM admin_employees
      WHERE id = ${session.id} AND tenant_slug = ${session.tenantSlug}
      LIMIT 1
    `;
    const departmentId = empInfo[0]?.department_id || "";
    const employeeRole = (empInfo[0]?.role || session.role || "staff").toLowerCase();

    // Determine routing based on role
    // staff -> HOD of their department
    // hod -> HR/Admin (tenant admin)
    // executive -> tenant admin
    let approverRole = "hod";
    let approverId: string | null = null;
    let hodName = "N/A";

    if (employeeRole === "executive" || employeeRole === "ceo" || employeeRole === "cfo" || employeeRole === "coo" || employeeRole === "cto") {
      // Executive reports go to tenant admin
      approverRole = "tenant_admin";
      approverId = null; // any tenant admin can approve
      hodName = "Tenant Admin";
    } else if (employeeRole === "hod" || employeeRole === "head_of_department") {
      // HOD reports go to HR/Admin
      approverRole = "hr_admin";
      approverId = null; // any HR admin can approve
      hodName = "HR Admin";
    } else {
      // Staff reports go to their HOD
      approverRole = "hod";
      if (departmentId) {
        const hod = await sql`
          SELECT id, name FROM admin_employees
          WHERE tenant_slug = ${session.tenantSlug}
            AND department_id = ${departmentId}
            AND (role = 'hod' OR role = 'head_of_department')
          LIMIT 1
        `;
        if (hod.length > 0) {
          hodName = hod[0].name;
          approverId = hod[0].id;
        }
      }
    }

    // Store KPI metrics in the appraisal JSON field
    const appraisal = d.kpiMetrics && d.kpiMetrics.length > 0
      ? JSON.stringify({ kpiMetrics: d.kpiMetrics })
      : null;

    try {
      await sql`
        INSERT INTO admin_staff_reports (
          id, tenant_slug, employee_id, title, report_type, report_date,
          objectives, achievements, challenges, next_steps, additional_notes,
          meetings, blockers, activities, head_of_department, department_id,
          status, appraisal, submitter_role, approver_role, approver_id, team_members
        ) VALUES (
          ${id}, ${session.tenantSlug}, ${session.id},
          ${d.title || `${d.reportType} report for ${d.reportDate}`},
          ${d.reportType}, ${d.reportDate},
          ${d.objectives}, ${d.achievements}, ${d.challenges},
          ${d.nextSteps}, ${d.additionalNotes},
          ${d.meetings}, ${d.blockers}, ${d.activities},
          ${hodName}, ${departmentId},
          'pending', ${appraisal}::jsonb,
          ${employeeRole}, ${approverRole}, ${approverId},
          ${d.teamMembers}
        )
      `;
    } catch (insertErr: any) {
      console.error("Full insert failed, trying without new columns:", insertErr?.message);
      // Fallback: insert without team_members, submitter_role, approver_role, approver_id
      // (these columns may not exist on the production DB yet)
      await sql`
        INSERT INTO admin_staff_reports (
          id, tenant_slug, employee_id, title, report_type, report_date,
          objectives, achievements, challenges, next_steps, additional_notes,
          meetings, blockers, activities, head_of_department, department_id,
          status, appraisal
        ) VALUES (
          ${id}, ${session.tenantSlug}, ${session.id},
          ${d.title || `${d.reportType} report for ${d.reportDate}`},
          ${d.reportType}, ${d.reportDate},
          ${d.objectives}, ${d.achievements}, ${d.challenges},
          ${d.nextSteps}, ${d.additionalNotes},
          ${d.meetings}, ${d.blockers}, ${d.activities},
          ${hodName}, ${departmentId},
          'pending', ${appraisal}::jsonb
        )
      `;
    }

    const record = await sql`SELECT * FROM admin_staff_reports WHERE id = ${id}`;
    return NextResponse.json({ success: true, report: record[0] }, { status: 201 });
  } catch (error: any) {
    console.error("Employee report create error:", error?.message || error, error?.stack);
    return NextResponse.json({ error: "Failed to submit report", detail: error?.message || String(error) }, { status: 500 });
  }
}
