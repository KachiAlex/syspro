export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql as SQL } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import { runAgent } from "@/lib/ai/agent";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Roles that receive pushed AI insights. */
const NOTIFY_ROLES = ["admin", "tenant_admin", "executive", "hod", "hr", "hr_admin", "hr_manager"];

function severityToType(severity: string): "info" | "warning" | "error" {
  if (severity === "high") return "error";
  if (severity === "medium") return "warning";
  return "info";
}

function categoryToNotification(category: string): "hr" | "finance" | "crm" | "system" {
  if (category === "crm") return "crm";
  if (category === "procurement") return "finance";
  if (category === "reports" || category === "appraisals" || category === "recruitment" || category === "attendance") return "hr";
  return "system";
}

/**
 * POST /api/cron/insights
 * Nightly sweep: run proactive_insights per active tenant and push new
 * findings into admin_notifications for leadership roles. Dedupes by title
 * within 24h so recurring conditions don't spam.
 * Auth: Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureHrTables(SQL);

    const tenants = await SQL`
      select slug from tenants
      where slug is not null
        and lower(coalesce(status, '')) not in ('suspended', 'cancelled', 'terminated', 'deleted')
    `;

    const summary: Array<{ tenant: string; insights: number; notified: number; error?: string }> = [];

    for (const t of tenants as any[]) {
      const tenantSlug = t.slug as string;
      try {
        const result = await runAgent({
          capability: "proactive_insights",
          payload: {},
          tenantSlug,
        });
        const insights = ((result?.result as any)?.insights ?? []) as Array<{
          category: string;
          severity: string;
          title: string;
          description: string;
          recommendedAction: string;
        }>;
        if (insights.length === 0) {
          summary.push({ tenant: tenantSlug, insights: 0, notified: 0 });
          continue;
        }

        const targets = await SQL`
          select id from admin_employees
          where tenant_slug = ${tenantSlug} and status = 'active'
            and lower(coalesce(role, '')) = any(${NOTIFY_ROLES as any})
        `;
        const targetIds = (targets as any[]).map((r) => r.id);
        if (targetIds.length === 0) {
          summary.push({ tenant: tenantSlug, insights: insights.length, notified: 0 });
          continue;
        }

        // Titles already pushed in the last 24h — dedupe per tenant.
        const recent = await SQL`
          select distinct title from admin_notifications
          where tenant_slug = ${tenantSlug}
            and title like 'AI Insight:%'
            and created_at >= now() - interval '24 hours'
        `;
        const seenTitles = new Set((recent as any[]).map((r) => r.title));

        let notified = 0;
        for (const insight of insights.slice(0, 10)) {
          const title = `AI Insight: ${insight.title}`;
          if (seenTitles.has(title)) continue;
          const message = `${insight.description}\n\nRecommended: ${insight.recommendedAction}`;
          for (const employeeId of targetIds.slice(0, 25)) {
            await SQL`
              insert into admin_notifications (id, tenant_slug, employee_id, type, category, title, message, action_url)
              values (${crypto.randomUUID()}, ${tenantSlug}, ${employeeId}, ${severityToType(insight.severity)}, ${categoryToNotification(insight.category)}, ${title}, ${message}, '/tenant-admin')
            `;
            notified++;
          }
          seenTitles.add(title);
        }
        summary.push({ tenant: tenantSlug, insights: insights.length, notified });
      } catch (err: any) {
        summary.push({ tenant: tenantSlug, insights: 0, notified: 0, error: err?.message });
      }
    }

    return NextResponse.json({ ok: true, tenants: summary });
  } catch (error: any) {
    console.error("[cron/insights] error:", error?.message);
    return NextResponse.json({ error: "Insight sweep failed" }, { status: 500 });
  }
}
