import { NextRequest, NextResponse } from "next/server";
import { decodeEmployeeToken } from "@/lib/hr/auth";
import { sql as SQL } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

/**
 * GET /api/hr/employees/portal/appraisal?employeeId=...
 * Returns data needed for AI appraisal: KPIs, reports, tasks for the employee.
 * HR-only.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get("employee_session")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const session = decodeEmployeeToken(token);
  if (!session) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const employeeRole = (session.role || "staff").toLowerCase();
  const isHR = employeeRole === "hr" || employeeRole === "hr_admin" || employeeRole === "hr_manager";
  if (!isHR) {
    return NextResponse.json({ error: "Only HR can access appraisals" }, { status: 403 });
  }

  try {
    try { await ensureHrTables(SQL); } catch (e) { console.error("ensureHrTables failed:", (e as any)?.message); }

    const url = new URL(request.url);
    const employeeId = url.searchParams.get("employeeId");
    if (!employeeId) {
      return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
    }

    // Fetch employee info
    const empRows = await SQL`
      SELECT id, name, email, job_title, role, department_id, hire_date
      FROM admin_employees
      WHERE id = ${employeeId} AND tenant_slug = ${session.tenantSlug}
      LIMIT 1
    `;
    if (empRows.length === 0) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    const employee = empRows[0];

    // Fetch KPIs / tasks
    let tasks: any[] = [];
    try {
      tasks = await SQL`
        SELECT id, title, description, expected_outcome, weight, is_kpi, frequency, due_date, status, completion_note
        FROM admin_staff_tasks
        WHERE tenant_slug = ${session.tenantSlug} AND employee_id = ${employeeId}
        ORDER BY created_at DESC
        LIMIT 100
      `;
    } catch (e) {
      tasks = await SQL`
        SELECT id, title, description, frequency, due_date, status
        FROM admin_staff_tasks
        WHERE tenant_slug = ${session.tenantSlug} AND employee_id = ${employeeId}
        ORDER BY created_at DESC
        LIMIT 100
      `;
    }

    // Fetch reports
    let reports: any[] = [];
    try {
      reports = await SQL`
        SELECT id, title, report_type, report_date, objectives, achievements, challenges,
               next_steps, meetings, blockers, activities, status, submitted_at, appraisal
        FROM admin_staff_reports
        WHERE tenant_slug = ${session.tenantSlug} AND employee_id = ${employeeId}
        ORDER BY submitted_at DESC
        LIMIT 50
      `;
    } catch (e) {
      reports = await SQL`
        SELECT id, title, report_type, report_date, objectives, achievements, status, submitted_at
        FROM admin_staff_reports
        WHERE tenant_slug = ${session.tenantSlug} AND employee_id = ${employeeId}
        ORDER BY submitted_at DESC
        LIMIT 50
      `;
    }

    // Fetch attendance summary (last 30 days)
    let attendance: any[] = [];
    try {
      attendance = await SQL`
        SELECT status, check_in, check_out, date
        FROM admin_attendance
        WHERE tenant_slug = ${session.tenantSlug} AND employee_id = ${employeeId}
          AND date >= NOW() - INTERVAL '30 days'
        ORDER BY date DESC
        LIMIT 30
      `;
    } catch (e) {
      // Attendance table may not exist
    }

    return NextResponse.json({
      employee,
      tasks,
      reports,
      attendance,
    });
  } catch (error: any) {
    console.error("Appraisal GET error:", error?.message);
    return NextResponse.json({ error: "Failed to load appraisal data" }, { status: 500 });
  }
}

/**
 * POST /api/hr/employees/portal/appraisal
 * Generates an AI-based productivity appraisal for an employee.
 * HR-only. Uses Groq AI to analyze KPI completion + report quality.
 */
export async function POST(request: NextRequest) {
  const token = request.cookies.get("employee_session")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const session = decodeEmployeeToken(token);
  if (!session) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const employeeRole = (session.role || "staff").toLowerCase();
  const isHR = employeeRole === "hr" || employeeRole === "hr_admin" || employeeRole === "hr_manager";
  if (!isHR) {
    return NextResponse.json({ error: "Only HR can generate appraisals" }, { status: 403 });
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return NextResponse.json({
      error: "AI feature is not configured. Set GROQ_API_KEY environment variable.",
    }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { employee, tasks, reports, attendance } = body;

    if (!employee || !tasks || !reports) {
      return NextResponse.json({ error: "Missing required data" }, { status: 400 });
    }

    // Build context for AI
    const kpiTasks = tasks.filter((t: any) => t.is_kpi);
    const completedTasks = tasks.filter((t: any) => t.status === "completed");
    const pendingTasks = tasks.filter((t: any) => t.status === "pending" || t.status === "in_progress");
    const overdueTasks = tasks.filter((t: any) => t.status === "overdue" || (t.due_date && new Date(t.due_date) < new Date() && t.status !== "completed"));

    const approvedReports = reports.filter((r: any) => r.status === "approved");
    const pendingReports = reports.filter((r: any) => r.status === "pending" || r.status === "under_review");
    const rejectedReports = reports.filter((r: any) => r.status === "rejected" || r.status === "needs_edit");

    const presentDays = attendance.filter((a: any) => a.status === "present").length;
    const lateDays = attendance.filter((a: any) => a.status === "late").length;
    const absentDays = attendance.filter((a: any) => a.status === "absent").length;

    const kpiCompletionRate = kpiTasks.length > 0
      ? Math.round((kpiTasks.filter((t: any) => t.status === "completed").length / kpiTasks.length) * 100)
      : 0;

    const reportApprovalRate = reports.length > 0
      ? Math.round((approvedReports.length / reports.length) * 100)
      : 0;

    const attendanceRate = attendance.length > 0
      ? Math.round((presentDays / attendance.length) * 100)
      : 0;

    const systemPrompt = `You are an expert HR analyst. Generate a comprehensive productivity appraisal for an employee based on their KPI completion, report quality, and attendance data.

Return a JSON object with this exact structure:
{
  "overallScore": <number 1-100>,
  "categories": {
    "kpiPerformance": { "score": <1-100>, "summary": "<2-3 sentences>" },
    "reportQuality": { "score": <1-100>, "summary": "<2-3 sentences>" },
    "attendance": { "score": <1-100>, "summary": "<2-3 sentences>" },
    "taskExecution": { "score": <1-100>, "summary": "<2-3 sentences>" }
  },
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": ["<area 1>", "<area 2>", "<area 3>"],
  "recommendation": "<1 paragraph summary with actionable recommendations>",
  "rating": "<one of: Excellent | Good | Satisfactory | Needs Improvement | Poor>"
}

Be fair, data-driven, and constructive. Use the metrics provided to justify scores.`;

    const userPrompt = `Employee: ${employee.name} (${employee.job_title || "Staff"})
Role: ${employee.role}
Hire Date: ${employee.hire_date || "N/A"}

KPI/TASK METRICS:
- Total KPIs: ${kpiTasks.length}
- KPI Completion Rate: ${kpiCompletionRate}%
- Completed Tasks: ${completedTasks.length}
- Pending/In-Progress Tasks: ${pendingTasks.length}
- Overdue Tasks: ${overdueTasks.length}

KPI Details:
${kpiTasks.slice(0, 10).map((t: any, i: number) => `${i+1}. ${t.title} (Weight: ${t.weight || 1}, Status: ${t.status}, Due: ${t.due_date || "N/A"})${t.expected_outcome ? ` — Expected: ${t.expected_outcome}` : ""}${t.completion_note ? ` — Completion Note: ${t.completion_note}` : ""}`).join("\n")}

REPORT METRICS:
- Total Reports: ${reports.length}
- Approved: ${approvedReports.length}
- Pending/Under Review: ${pendingReports.length}
- Rejected/Needs Edit: ${rejectedReports.length}
- Report Approval Rate: ${reportApprovalRate}%

Recent Report Summaries (last 5):
${reports.slice(0, 5).map((r: any, i: number) => `${i+1}. ${r.title || r.report_type + " report"} (${r.report_type}, ${r.report_date}) — Status: ${r.status}
   Objectives: ${(r.objectives || "").substring(0, 200)}
   Achievements: ${(r.achievements || "").substring(0, 200)}
   ${r.challenges ? "Challenges: " + r.challenges.substring(0, 150) : ""}`).join("\n")}

ATTENDANCE METRICS (last 30 days):
- Present: ${presentDays} days
- Late: ${lateDays} days
- Absent: ${absentDays} days
- Attendance Rate: ${attendanceRate}%

Generate the appraisal now.`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userPrompt },
    ];

    const aiRes = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "");
      console.error("Groq API error:", aiRes.status, errText);
      return NextResponse.json({ error: "AI service error" }, { status: 502 });
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: "AI returned empty response" }, { status: 500 });
    }

    let appraisal;
    try {
      appraisal = JSON.parse(content);
    } catch {
      // Try to extract JSON from the content
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        appraisal = JSON.parse(match[0]);
      } else {
        return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, appraisal });
  } catch (error: any) {
    console.error("Appraisal POST error:", error?.message);
    return NextResponse.json({ error: "Failed to generate appraisal" }, { status: 500 });
  }
}
