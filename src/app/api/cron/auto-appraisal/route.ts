import { NextRequest, NextResponse } from "next/server";
import { sql as SQL } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import {
  generateAppraisal,
  type AppraisalPeriod,
} from "@/lib/ai/appraisal-engine";
import {
  saveAppraisal,
  getAppraisalHistory,
  getAppraisalConfig,
} from "@/lib/hr/db-appraisals";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureHrTables(SQL);

    const configs = await SQL`
      select * from admin_appraisal_config where auto_generate = true
    `;

    const results: any[] = [];

    for (const config of configs as any[]) {
      const tenantSlug = config.tenant_slug;
      const period = (config.auto_generate_frequency || "monthly") as AppraisalPeriod;
      const useAI = config.use_ai ?? true;
      const groqKey = useAI ? process.env.GROQ_API_KEY : undefined;
      const weights = typeof config.weights === "string" ? JSON.parse(config.weights) : config.weights;

      const periodStart = new Date();
      if (period === "weekly") periodStart.setDate(periodStart.getDate() - 7);
      else if (period === "monthly") periodStart.setMonth(periodStart.getMonth() - 1);
      else if (period === "quarterly") periodStart.setMonth(periodStart.getMonth() - 3);
      else if (period === "annual") periodStart.setFullYear(periodStart.getFullYear() - 1);

      const employees = await SQL`
        select id, name, email, job_title, role, department_id, hire_date
        from admin_employees
        where tenant_slug = ${tenantSlug} and status = 'active'
      `;

      for (const emp of employees as any[]) {
        try {
          const tasks = await SQL`
            select id, title, description, expected_outcome, weight, is_kpi, frequency, due_date, status, completion_note
            from admin_staff_tasks
            where tenant_slug = ${tenantSlug} and employee_id = ${emp.id}
              and created_at >= ${periodStart.toISOString()}
            order by created_at desc limit 200
          `;

          const reports = await SQL`
            select id, title, report_type, report_date, objectives, achievements, challenges,
                   next_steps, meetings, blockers, activities, additional_notes, refined_text,
                   status, submitted_at
            from admin_staff_reports
            where tenant_slug = ${tenantSlug} and employee_id = ${emp.id}
              and submitted_at >= ${periodStart.toISOString()}
            order by submitted_at desc limit 100
          `;

          let attendance: any[] = [];
          try {
            attendance = await SQL`
              select status, check_in, check_out, date
              from admin_attendance
              where tenant_slug = ${tenantSlug} and employee_id = ${emp.id}
                and date >= ${periodStart.toISOString().split("T")[0]}
              order by date desc limit 90
            `;
          } catch {}

          const previousAppraisals = await getAppraisalHistory(tenantSlug, emp.id, 5);

          const result = await generateAppraisal(
            {
              employee: emp,
              tasks: tasks as any[],
              reports: reports as any[],
              attendance,
              previousAppraisals,
              weights,
              period,
              periodStart: periodStart.toISOString(),
              periodEnd: new Date().toISOString(),
              useAI,
            },
            groqKey,
          );
          result.tenantSlug = tenantSlug;

          const appraisalId = await saveAppraisal(tenantSlug, result, "Auto-Generated");
          results.push({ employeeId: emp.id, name: emp.name, score: result.overallScore, appraisalId });
        } catch (e) {
          console.error(`Auto-appraisal failed for ${emp.id}:`, (e as any)?.message);
        }
      }
    }

    return NextResponse.json({ success: true, generated: results.length, results });
  } catch (error: any) {
    console.error("Auto-appraisal cron error:", error?.message);
    return NextResponse.json({ error: "Failed to run auto-appraisals" }, { status: 500 });
  }
}
