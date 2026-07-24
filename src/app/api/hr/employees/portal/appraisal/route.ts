import { NextRequest, NextResponse } from "next/server";
import { resolveEmployeeSession } from "@/lib/hr/auth";
import { sql as SQL } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import {
  generateAppraisal,
  computeDeterministicMetrics,
  type AppraisalPeriod,
  type AppraisalResult,
} from "@/lib/ai/appraisal-engine";
import {
  saveAppraisal,
  getAppraisalHistory,
  getDepartmentAppraisals,
  getTenantAppraisals,
  shareAppraisalWithEmployee,
  acknowledgeAppraisal,
  getEmployeeSharedAppraisals,
  getAppraisalConfig,
  saveAppraisalConfig,
  getPeerFeedbackForEmployee,
  getEmployeeGoals,
  type AppraisalConfigRecord,
} from "@/lib/hr/db-appraisals";

// ─── Period helpers ───

function getPeriodRange(period: AppraisalPeriod): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  switch (period) {
    case 'weekly':
      start.setDate(start.getDate() - 7);
      break;
    case 'monthly':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'quarterly':
      start.setMonth(start.getMonth() - 3);
      break;
    case 'annual':
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      start.setMonth(start.getMonth() - 1);
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

// ─── Data Fetching ───

async function fetchEmployeeData(tenantSlug: string, employeeId: string, periodStart: string) {
  const empRows = await SQL`
    SELECT id, name, email, job_title, role, department_id, hire_date
    FROM admin_employees
    WHERE id = ${employeeId} AND tenant_slug = ${tenantSlug}
    LIMIT 1
  `;
  const employee = (empRows as any[])[0];
  if (!employee) return null;

  let tasks: any[] = [];
  try {
    tasks = await SQL`
      SELECT id, title, description, expected_outcome, weight, is_kpi, frequency, due_date, status, completion_note
      FROM admin_staff_tasks
      WHERE tenant_slug = ${tenantSlug} AND employee_id = ${employeeId}
        AND created_at >= ${periodStart}
      ORDER BY created_at DESC
      LIMIT 200
    `;
  } catch {
    tasks = await SQL`
      SELECT id, title, description, frequency, due_date, status
      FROM admin_staff_tasks
      WHERE tenant_slug = ${tenantSlug} AND employee_id = ${employeeId}
      ORDER BY created_at DESC
      LIMIT 200
    `;
  }

  let reports: any[] = [];
  try {
    reports = await SQL`
      SELECT id, title, report_type, report_date, objectives, achievements, challenges,
             next_steps, meetings, blockers, activities, additional_notes, refined_text,
             status, submitted_at, appraisal
      FROM admin_staff_reports
      WHERE tenant_slug = ${tenantSlug} AND employee_id = ${employeeId}
        AND submitted_at >= ${periodStart}
      ORDER BY submitted_at DESC
      LIMIT 100
    `;
  } catch {
    reports = await SQL`
      SELECT id, title, report_type, report_date, objectives, achievements, status, submitted_at
      FROM admin_staff_reports
      WHERE tenant_slug = ${tenantSlug} AND employee_id = ${employeeId}
      ORDER BY submitted_at DESC
      LIMIT 100
    `;
  }

  let attendance: any[] = [];
  try {
    attendance = await SQL`
      SELECT status, check_in, check_out, date
      FROM admin_attendance
      WHERE tenant_slug = ${tenantSlug} AND employee_id = ${employeeId}
        AND date >= ${periodStart.split('T')[0]}
      ORDER BY date DESC
      LIMIT 90
    `;
  } catch {}

  let peerFeedback: any[] = [];
  try {
    peerFeedback = await getPeerFeedbackForEmployee(tenantSlug, employeeId);
  } catch {}

  let goals: any[] = [];
  try {
    goals = await getEmployeeGoals(tenantSlug, employeeId);
  } catch {}

  return { employee, tasks, reports, attendance, peerFeedback, goals };
}

// ─── GET: Fetch appraisal data, history, benchmarks, config ───

export async function GET(request: NextRequest) {
  const session = resolveEmployeeSession(request);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const employeeRole = (session.role || "staff").toLowerCase();
  const isHR = employeeRole === "hr" || employeeRole === "hr_admin" || employeeRole === "hr_manager";

  const url = new URL(request.url);
  const employeeId = url.searchParams.get("employeeId");
  const action = url.searchParams.get("action") || "data";

  try {
    await ensureHrTables(SQL);

    if (action === "config") {
      if (!isHR) return NextResponse.json({ error: "Only HR can manage appraisal config" }, { status: 403 });
      const config = await getAppraisalConfig(session.tenantSlug);
      return NextResponse.json({ config });
    }

    if (action === "history") {
      if (!employeeId) return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
      const history = await getAppraisalHistory(session.tenantSlug, employeeId, 50);
      return NextResponse.json({ history });
    }

    if (action === "benchmark") {
      if (!isHR) return NextResponse.json({ error: "Only HR can view benchmarks" }, { status: 403 });
      if (!employeeId) return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
      const empRows = await SQL`
        SELECT department_id FROM admin_employees
        WHERE id = ${employeeId} AND tenant_slug = ${session.tenantSlug}
        LIMIT 1
      `;
      const emp = (empRows as any[])[0];
      if (!emp?.department_id) return NextResponse.json({ benchmark: null });
      const deptAppraisals = await getDepartmentAppraisals(session.tenantSlug, emp.department_id, 100);
      const latestByEmp = new Map<string, AppraisalResult>();
      for (const a of deptAppraisals) {
        if (!latestByEmp.has(a.employeeId)) latestByEmp.set(a.employeeId, a);
      }
      const peerScores = Array.from(latestByEmp.values()).filter(a => a.employeeId !== employeeId);
      const deptAvg = peerScores.length > 0
        ? Math.round(peerScores.reduce((s, a) => s + a.overallScore, 0) / peerScores.length)
        : null;
      const empAppraisal = latestByEmp.get(employeeId);
      const percentile = peerScores.length > 0 && empAppraisal
        ? Math.round(peerScores.filter(a => a.overallScore <= empAppraisal.overallScore).length / peerScores.length * 100)
        : null;
      return NextResponse.json({
        benchmark: {
          departmentAverage: deptAvg,
          percentileRank: percentile,
          peerCount: peerScores.length,
          peerScores: peerScores.map(a => ({ employeeId: a.employeeId, score: a.overallScore, rating: a.rating })),
        },
      });
    }

    if (action === "self") {
      const targetId = employeeId || session.id;
      const shared = await getEmployeeSharedAppraisals(session.tenantSlug, targetId);
      return NextResponse.json({ appraisals: shared });
    }

    if (action === "list") {
      if (!isHR) return NextResponse.json({ error: "Only HR can list all appraisals" }, { status: 403 });
      const all = await getTenantAppraisals(session.tenantSlug, 200);
      return NextResponse.json({ appraisals: all });
    }

    // Default: fetch data for appraisal generation
    if (!employeeId) return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
    if (!isHR) return NextResponse.json({ error: "Only HR can access appraisal data" }, { status: 403 });

    const period = (url.searchParams.get("period") as AppraisalPeriod) || "monthly";
    const { start, end } = getPeriodRange(period);
    const data = await fetchEmployeeData(session.tenantSlug, employeeId, start);
    if (!data) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    const previousAppraisals = await getAppraisalHistory(session.tenantSlug, employeeId, 5);

    let departmentAppraisals: AppraisalResult[] = [];
    if (data.employee.department_id) {
      try {
        departmentAppraisals = await getDepartmentAppraisals(session.tenantSlug, data.employee.department_id, 50);
      } catch {}
    }

    let config: AppraisalConfigRecord | null = null;
    try { config = await getAppraisalConfig(session.tenantSlug); } catch {}

    const quickMetrics = computeDeterministicMetrics(data.tasks, data.reports, data.attendance);

    return NextResponse.json({
      ...data,
      period,
      periodStart: start,
      periodEnd: end,
      previousAppraisals,
      departmentAppraisals: departmentAppraisals.filter(a => a.employeeId !== employeeId),
      config,
      quickMetrics,
    });
  } catch (error: any) {
    console.error("Appraisal GET error:", error?.message);
    return NextResponse.json({ error: "Failed to load appraisal data" }, { status: 500 });
  }
}

// ─── POST: Generate appraisal ───

export async function POST(request: NextRequest) {
  const session = resolveEmployeeSession(request);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const employeeRole = (session.role || "staff").toLowerCase();
  const isHR = employeeRole === "hr" || employeeRole === "hr_admin" || employeeRole === "hr_manager";
  if (!isHR) return NextResponse.json({ error: "Only HR can generate appraisals" }, { status: 403 });

  try {
    const body = await request.json();
    const { employeeId, period = "monthly", weights, useAI = true, persist = true } = body;
    if (!employeeId) return NextResponse.json({ error: "employeeId is required" }, { status: 400 });

    let config: AppraisalConfigRecord | null = null;
    try { config = await getAppraisalConfig(session.tenantSlug); } catch {}

    const mergedWeights = { ...(config?.weights || {}), ...(weights || {}) };
    const shouldUseAI = useAI && (config?.useAI ?? true);
    const groqKey = shouldUseAI ? process.env.GROQ_API_KEY : undefined;

    const { start, end } = getPeriodRange(period as AppraisalPeriod);
    const data = await fetchEmployeeData(session.tenantSlug, employeeId, start);
    if (!data) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    const previousAppraisals = await getAppraisalHistory(session.tenantSlug, employeeId, 5);

    let departmentAppraisals: AppraisalResult[] = [];
    if (data.employee.department_id) {
      try {
        departmentAppraisals = await getDepartmentAppraisals(session.tenantSlug, data.employee.department_id, 50);
      } catch {}
    }

    const result = await generateAppraisal(
      {
        employee: data.employee,
        tasks: data.tasks,
        reports: data.reports,
        attendance: data.attendance,
        previousAppraisals,
        departmentAppraisals: departmentAppraisals.filter(a => a.employeeId !== employeeId),
        peerFeedback: data.peerFeedback,
        goals: data.goals,
        weights: mergedWeights,
        period: period as AppraisalPeriod,
        periodStart: start,
        periodEnd: end,
        useAI: shouldUseAI,
      },
      groqKey,
    );
    result.tenantSlug = session.tenantSlug;

    let appraisalId: string | undefined;
    if (persist) {
      try {
        appraisalId = await saveAppraisal(session.tenantSlug, result, session.name);
        result.id = appraisalId;
      } catch (e) {
        console.error("Failed to persist appraisal:", (e as any)?.message);
      }
    }

    return NextResponse.json({ success: true, appraisal: result, appraisalId });
  } catch (error: any) {
    console.error("Appraisal POST error:", error?.message);
    return NextResponse.json({ error: "Failed to generate appraisal" }, { status: 500 });
  }
}

// ─── PATCH: Config, share, acknowledge ───

export async function PATCH(request: NextRequest) {
  const session = resolveEmployeeSession(request);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const employeeRole = (session.role || "staff").toLowerCase();
  const isHR = employeeRole === "hr" || employeeRole === "hr_admin" || employeeRole === "hr_manager";

  try {
    const body = await request.json();
    const { action } = body;

    if (action === "saveConfig") {
      if (!isHR) return NextResponse.json({ error: "Only HR can save appraisal config" }, { status: 403 });
      await saveAppraisalConfig(session.tenantSlug, {
        weights: body.weights,
        autoGenerate: body.autoGenerate,
        autoGenerateFrequency: body.autoGenerateFrequency,
        autoGenerateDay: body.autoGenerateDay,
        useAI: body.useAI,
        roleTemplates: body.roleTemplates,
      });
      return NextResponse.json({ success: true });
    }

    if (action === "share") {
      if (!isHR) return NextResponse.json({ error: "Only HR can share appraisals" }, { status: 403 });
      const { appraisalId } = body;
      if (!appraisalId) return NextResponse.json({ error: "appraisalId is required" }, { status: 400 });
      await shareAppraisalWithEmployee(session.tenantSlug, appraisalId);
      return NextResponse.json({ success: true });
    }

    if (action === "acknowledge") {
      const { appraisalId } = body;
      if (!appraisalId) return NextResponse.json({ error: "appraisalId is required" }, { status: 400 });
      await acknowledgeAppraisal(session.tenantSlug, appraisalId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("Appraisal PATCH error:", error?.message);
    return NextResponse.json({ error: "Failed to update appraisal" }, { status: 500 });
  }
}
