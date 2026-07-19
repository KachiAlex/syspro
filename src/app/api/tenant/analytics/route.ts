import { NextRequest, NextResponse } from "next/server";
import {
  validateTenantContext,
  parseJsonRequest,
  getPaginationParams,
  getSortParams,
  errorResponse,
  handleTenantAdminError,
  checkRateLimit,
  asTenantSlug,
} from "@/lib/tenant-admin/utils";
import { AuditService } from "@/lib/tenant-admin/service";
import { AuditAction, UserId, ResourceId } from "@/lib/tenant-admin/types";
import { db } from "@/lib/sql-client";
import { z } from "zod";

const CreateReportSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.string().min(1).optional(),
  reportType: z.string().min(1).optional(),
  filters: z.record(z.any()).optional(),
  metrics: z.array(z.string()).optional(),
  schedule: z.enum(["once", "daily", "weekly", "monthly"]).optional(),
});

const ExportReportSchema = z.object({
  name: z.string().min(1).optional(),
  reportId: z.string().optional(),
  format: z.enum(["csv", "json", "pdf", "xlsx"]).optional().default("csv"),
  frequency: z.string().optional(),
  scheduleFor: z.string().datetime().optional(),
});

async function safeQuery<T = any>(query: string, params: any[] = []): Promise<T[] | null> {
  try {
    const result = await db.query<T>(query, params);
    return result.rows || [];
  } catch (err) {
    console.error("Analytics query failed:", query, err);
    return null;
  }
}

function safeNumber(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function computeTrend(current: number, previous: number) {
  if (!previous) return { growth: 0, trend: current > 0 ? "up" : "flat" };
  const growth = Math.round(((current - previous) / previous) * 100);
  return { growth, trend: growth >= 0 ? "up" : "down" };
}

/**
 * GET /api/tenant/analytics
 * Retrieve analytics reports and metrics from real database tables.
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`analytics-get-${context.tenantSlug}`, 50, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const tenantSlug = context.tenantSlug;
    const type = new URL(request.url).searchParams.get("type") || "overview";
    const pagination = getPaginationParams(request);
    const sort = getSortParams(request);
    const periodDays = Math.min(Math.max(Number(new URL(request.url).searchParams.get("days") || "30"), 1), 365);

    const action = new URL(request.url).searchParams.get("action");

    if (action === "download") {
      const reportId = new URL(request.url).searchParams.get("reportId");
      const format = (new URL(request.url).searchParams.get("format") || "csv").toLowerCase();
      if (!reportId) {
        return errorResponse("Report ID is required", 400);
      }
      const report = (await safeQuery<any>(
        `select
          coalesce((changes->'after'->>'id'), resource_id) as id,
          coalesce((changes->'after'->>'name'), 'Untitled') as name,
          coalesce((changes->'after'->>'reportType'), (changes->'after'->>'type'), 'report') as "reportType",
          (changes->'after') as payload,
          created_at as "createdAt"
        from admin_audit_logs
        where tenant_slug = $1 and resource = 'report' and action = 'create'
          and (
            (changes->'after'->>'id') = $2
            or resource_id = $2
          )
        order by created_at desc
        limit 1`,
        [tenantSlug, reportId]
      ))?.[0];
      if (!report) {
        return errorResponse("Report not found", 404);
      }
      const payload = report.payload || {};
      const headers = ["Field", "Value"];
      const rows = Object.entries({ id: report.id, name: report.name, type: report.reportType, ...payload, createdAt: report.createdAt }).map(([k, v]) => [JSON.stringify(k), JSON.stringify(v)]);
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      return new NextResponse(csv, { status: 200, headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${report.name.replace(/\s+/g, "-")}.csv"` } });
    }

    if (type === "reports") {
      const reports = (await safeQuery<any>(
        `select
          coalesce((changes->'after'->>'id'), resource_id) as id,
          coalesce((changes->'after'->>'name'), 'Untitled') as name,
          coalesce((changes->'after'->>'reportType'), (changes->'after'->>'type'), 'report') as "reportType",
          coalesce((changes->'after'->>'module'), 'general') as "module",
          coalesce((changes->'after'->>'status'), 'Completed') as "status",
          (changes->'after'->>'schedule') as schedule,
          coalesce((changes->'after'->>'rows')::int, 0) as "dataPoints",
          coalesce((changes->'after'->>'createdAt')::timestamptz, created_at) as "createdAt"
        from admin_audit_logs
        where tenant_slug = $1 and resource = 'report' and action = 'create'
        order by coalesce((changes->'after'->>'createdAt')::timestamptz, created_at) desc
        limit $2 offset $3`,
        [tenantSlug, pagination.limit, (pagination.page - 1) * pagination.limit]
      )) || [];
      const total = (await safeQuery<{ count: number }>(
        `select count(*)::int as count from admin_audit_logs where tenant_slug = $1 and resource = 'report' and action = 'create'`,
        [tenantSlug]
      ))?.[0]?.count || 0;
      return NextResponse.json({
        success: true,
        data: { reports, pagination: { page: pagination.page, limit: pagination.limit, total } },
      });
    } else if (type === "metrics") {
      const deptResult = (await safeQuery<{ total: number; avg: number }>(
        `select
          (select count(*)::int from admin_departments where tenant_slug = $1) as total,
          coalesce((select avg(emp_count)::float from (
            select count(*) as emp_count from admin_employees where tenant_slug = $1 group by department_id
          ) sub), 0) as avg`,
        [tenantSlug]
      ))?.[0];

      const employeeRows = (await safeQuery<{ status: string; count: number }>(
        `select status, count(*)::int as count from admin_employees where tenant_slug = $1 group by status`,
        [tenantSlug]
      )) || [];
      const empTotal = employeeRows.reduce((sum, r) => sum + safeNumber(r.count), 0);
      const empActive = employeeRows.find((r) => r.status === 'active')?.count || 0;
      const empByStatus = Object.fromEntries(employeeRows.map((r) => [r.status, safeNumber(r.count)]));
      const tenureResult = (await safeQuery<{ avg: number; terminated: number }>(
        `select
          coalesce(avg(extract(epoch from (now() - hire_date)) / 86400 / 365.25), 0) as avg,
          count(*) filter (where status = 'terminated')::int as terminated
        from admin_employees where tenant_slug = $1`,
        [tenantSlug]
      ))?.[0];

      const approvalRows = (await safeQuery<{ status: string; count: number; avg: number }>(
        `select
          status,
          count(*)::int as count,
          coalesce(avg(extract(epoch from (updated_at - created_at))), 0) as avg
        from admin_approval_requests where tenant_slug = $1 group by status`,
        [tenantSlug]
      )) || [];
      const approvals = Object.fromEntries(approvalRows.map((r) => [r.status, r.count]));
      const approvedAvg = approvalRows.find((r) => r.status === 'approved')?.avg || 0;

      const workflowResult = (await safeQuery<{ total: number; active: number; executed: number }>(
        `select
          (select count(*)::int from admin_workflows where tenant_slug = $1) as total,
          (select count(*)::int from admin_workflows where tenant_slug = $1 and is_active = true) as active,
          (select count(*)::int from admin_audit_logs where tenant_slug = $1 and resource = 'workflow' and action = 'execute') as executed`,
        [tenantSlug]
      ))?.[0];

      return NextResponse.json({
        success: true,
        data: {
          departments: { total: safeNumber(deptResult?.total), active: safeNumber(deptResult?.total), avgEmployeesPerDept: safeNumber(deptResult?.avg) },
          employees: { total: empTotal, active: empActive, byStatus: empByStatus, avgTenure: safeNumber(tenureResult?.avg), turnover: empTotal ? safeNumber(tenureResult?.terminated) / empTotal : 0 },
          approvals: {
            pending: safeNumber(approvals['pending']),
            approved: safeNumber(approvals['approved']),
            rejected: safeNumber(approvals['rejected']),
            avgTimeToApprove: Math.round(approvedAvg),
          },
          workflows: { total: safeNumber(workflowResult?.total), active: safeNumber(workflowResult?.active), executed: safeNumber(workflowResult?.executed) },
        },
      });
    } else if (type === "security") {
      const security = (await safeQuery<{ auditLogsCount: number; activePolicies: number; suspicious: number; lastUpdate: string | null }>(
        `select
          (select count(*)::int from admin_audit_logs where tenant_slug = $1) as "auditLogsCount",
          (select count(*)::int from admin_security_policies where tenant_slug = $1 and is_active = true) as "activePolicies",
          (select count(*)::int from admin_audit_logs where tenant_slug = $1 and action in ('permission_change', 'delete')) as suspicious,
          (select max(updated_at)::text from admin_security_policies where tenant_slug = $1) as "lastUpdate"`,
        [tenantSlug]
      ))?.[0];
      return NextResponse.json({
        success: true,
        data: {
          auditLogsCount: safeNumber(security?.auditLogsCount),
          activePolicies: safeNumber(security?.activePolicies),
          suspiciousActivities: safeNumber(security?.suspicious),
          lastPolicyUpdate: security?.lastUpdate || null,
        },
      });
    } else if (type === "overview") {
      const currentStart = `now() - interval '${periodDays} days'`;
      const previousStart = `now() - interval '${periodDays * 2} days'`;

      const revenueResult = (await safeQuery<{ current: number; previous: number }>(
        `select
          coalesce(sum(total) filter (where created_at >= ${currentStart}), 0) as current,
          coalesce(sum(total) filter (where created_at >= ${previousStart} and created_at < ${currentStart}), 0) as previous
        from finance_invoices where tenant_slug = $1`,
        [tenantSlug]
      ))?.[0];

      const customerResult = (await safeQuery<{ current: number; previous: number }>(
        `select
          count(*) filter (where created_at >= ${currentStart})::int as current,
          count(*) filter (where created_at >= ${previousStart} and created_at < ${currentStart})::int as previous
        from crm_customers where tenant_slug = $1`,
        [tenantSlug]
      ))?.[0];

      const orderResult = (await safeQuery<{ current: number; previous: number }>(
        `select
          count(*) filter (where created_at >= ${currentStart})::int as current,
          count(*) filter (where created_at >= ${previousStart} and created_at < ${currentStart})::int as previous
        from purchase_orders where tenant_slug = $1`,
        [tenantSlug]
      ))?.[0];

      const conversionResult = (await safeQuery<{ current: number; previous: number; totalLeads: number }>(
        `select
          count(c.id) filter (where c.created_at >= ${currentStart})::int as current,
          count(c.id) filter (where c.created_at >= ${previousStart} and c.created_at < ${currentStart})::int as previous,
          nullif(count(l.id) filter (where l.created_at >= ${currentStart}), 0) as "totalLeads"
        from crm_leads l
        left join crm_conversions c on c.lead_id = l.id
        where l.tenant_slug = $1`,
        [tenantSlug]
      ))?.[0];

      const revenue = safeNumber(revenueResult?.current);
      const revenuePrevious = safeNumber(revenueResult?.previous);
      const customers = safeNumber(customerResult?.current);
      const customersPrevious = safeNumber(customerResult?.previous);
      const orders = safeNumber(orderResult?.current);
      const ordersPrevious = safeNumber(orderResult?.previous);
      const conversions = safeNumber(conversionResult?.current);
      const conversionLeads = safeNumber(conversionResult?.totalLeads);
      const conversionCurrent = conversionLeads ? Math.round((conversions / conversionLeads) * 100) : 0;
      const conversionPreviousRaw = safeNumber(conversionResult?.previous);

      const topProducts = (await safeQuery<{ name: string; sales: number; revenue: number }>(
        `select
          coalesce(description, 'Unknown') as name,
          coalesce(sum(quantity)::int, 0) as sales,
          coalesce(sum(quantity * unit_price), 0) as revenue
        from finance_invoice_lines
        where invoice_id in (select id from finance_invoices where tenant_slug = $1 and created_at >= ${currentStart})
        group by description
        order by revenue desc
        limit 5`,
        [tenantSlug]
      )) || [];

      const recentActivity = (await safeQuery<{ type: string; description: string; amount: string; time: string }>(
        `select
          action as type,
          resource || ' ' || resource_id as description,
          '' as amount,
          created_at::text as time
        from admin_audit_logs
        where tenant_slug = $1
        order by created_at desc
        limit 8`,
        [tenantSlug]
      )) || [];

      const reports = (await safeQuery<any>(
        `select
          coalesce((changes->'after'->>'id'), resource_id) as id,
          coalesce((changes->'after'->>'name'), 'Untitled') as name,
          coalesce((changes->'after'->>'reportType'), (changes->'after'->>'type'), 'report') as "reportType",
          (changes->'after'->>'schedule') as schedule,
          coalesce((changes->'after'->>'dataPoints')::int, 0) as "dataPoints",
          coalesce((changes->'after'->>'createdAt')::timestamptz, created_at) as "createdAt"
        from admin_audit_logs
        where tenant_slug = $1 and resource = 'report' and action = 'create'
        order by coalesce((changes->'after'->>'createdAt')::timestamptz, created_at) desc
        limit 20`,
        [tenantSlug]
      )) || [];

      const exports = (await safeQuery<any>(
        `select
          coalesce((changes->'after'->>'id'), resource_id) as id,
          coalesce((changes->'after'->>'name'), 'Untitled') as name,
          coalesce((changes->'after'->>'frequency'), 'daily') as frequency,
          coalesce((changes->'after'->>'format'), 'csv') as format,
          coalesce((changes->'after'->>'scheduleFor')::timestamptz, created_at) as "nextRun",
          created_at as "lastRun"
        from admin_audit_logs
        where tenant_slug = $1 and resource = 'export' and action = 'create'
        order by created_at desc
        limit 20`,
        [tenantSlug]
      )) || [];

      const revenueTrend = computeTrend(revenue, revenuePrevious);
      const customerTrend = computeTrend(customers, customersPrevious);
      const orderTrend = computeTrend(orders, ordersPrevious);
      const conversionTrend = computeTrend(conversionCurrent, conversionPreviousRaw ? Math.round((conversionPreviousRaw / Math.max(safeNumber(conversionResult?.totalLeads, 1))) * 100) : 0);

      return NextResponse.json({
        success: true,
        data: {
          reports,
          exports,
          revenue: { current: revenue, previous: revenuePrevious, growth: revenueTrend.growth, trend: revenueTrend.trend },
          customers: { current: customers, previous: customersPrevious, growth: customerTrend.growth, trend: customerTrend.trend },
          orders: { current: orders, previous: ordersPrevious, growth: orderTrend.growth, trend: orderTrend.trend },
          conversion: { current: conversionCurrent, previous: 0, growth: conversionTrend.growth, trend: conversionTrend.trend },
          topProducts: topProducts.map((p) => ({ name: p.name, sales: safeNumber(p.sales), revenue: safeNumber(p.revenue) })),
          recentActivity: recentActivity.map((a) => ({ ...a, amount: a.amount || '—' })),
          summary: { totalPages: 0, lastUpdated: new Date().toISOString() },
          charts: [],
        },
      });
    } else {
      return errorResponse("Invalid type parameter", 400);
    }
  } catch (error) {
    console.error("Analytics GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/analytics
 * Create or generate reports
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const action = new URL(request.url).searchParams.get("action") || "create";

    if (action === "create") {
      const parsed = await parseJsonRequest(request, CreateReportSchema);
      if (!parsed.success) {
        return errorResponse(parsed.error, 400, parsed.details);
      }

      const report = {
        id: `rep-${Date.now()}`,
        name: parsed.data.name,
        reportType: parsed.data.reportType || parsed.data.type || "custom",
        type: parsed.data.type || parsed.data.reportType || "custom",
        filters: parsed.data.filters,
        metrics: parsed.data.metrics,
        schedule: parsed.data.schedule,
        tenantSlug: context.tenantSlug,
        status: "generating",
        createdAt: new Date().toISOString(),
        createdBy: context.userId,
      };

      const auditService = new AuditService();
      await auditService.log(
        asTenantSlug(context.tenantSlug),
        context.userId as UserId,
        "create",
        "report",
        report.id as ResourceId,
        { after: report }
      );

      return NextResponse.json(
        {
          success: true,
          data: report,
          message: "Report generation started",
        },
        { status: 201 }
      );
    } else if (action === "export") {
      const parsed = await parseJsonRequest(request, ExportReportSchema);
      if (!parsed.success) {
        return errorResponse(parsed.error, 400, parsed.details);
      }

      const exportJob = {
        id: `exp-${Date.now()}`,
        name: parsed.data.name || `Export ${parsed.data.format || "csv"}`,
        reportId: parsed.data.reportId || null,
        format: parsed.data.format || "csv",
        frequency: parsed.data.frequency || "daily",
        scheduleFor: parsed.data.scheduleFor,
        tenantSlug: context.tenantSlug,
        status: "queued",
        createdAt: new Date().toISOString(),
        createdBy: context.userId,
      };

      const auditService = new AuditService();
      await auditService.log(
        asTenantSlug(context.tenantSlug),
        context.userId as UserId,
        "create",
        "export",
        exportJob.id as ResourceId,
        { after: exportJob }
      );

      return NextResponse.json(
        {
          success: true,
          data: exportJob,
          message: "Export job queued",
        },
        { status: 201 }
      );
    } else if (action === "run_export") {
      const body = await request.json().catch(() => ({}));
      const exportId = new URL(request.url).searchParams.get("exportId") || body.exportId;
      const run = {
        id: `run-${Date.now()}`,
        exportId: exportId || null,
        tenantSlug: context.tenantSlug,
        status: "running",
        startedAt: new Date().toISOString(),
        runBy: context.userId,
      };
      const auditService = new AuditService();
      await auditService.log(
        asTenantSlug(context.tenantSlug),
        context.userId as UserId,
        "execute",
        "export",
        run.id as ResourceId,
        { after: run }
      );
      return NextResponse.json({ success: true, data: run, message: "Export started" });
    } else {
      return errorResponse("Invalid action", 400);
    }
  } catch (error) {
    console.error("Analytics POST error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * PATCH /api/tenant/analytics?id=<id>
 * Update or re-run report
 */
export async function PATCH(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const id = new URL(request.url).searchParams.get("id");
    const action = new URL(request.url).searchParams.get("action") || "update";
    const resourceType = new URL(request.url).searchParams.get("type") || "report";

    if (!id) {
      return errorResponse("Report ID is required", 400);
    }

    const body = await request.json().catch(() => ({}));

    const updated = {
      id,
      ...body,
      tenantSlug: context.tenantSlug,
      updatedAt: new Date().toISOString(),
      updatedBy: context.userId,
    };

    const auditService = new AuditService();
    await auditService.log(
      asTenantSlug(context.tenantSlug),
      context.userId as UserId,
      action === "rerun" ? "execute" as AuditAction : "update",
      resourceType === "export" ? "export" : "report",
      id as ResourceId,
      { after: updated }
    );

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Report updated successfully",
    });
  } catch (error) {
    console.error("Analytics PATCH error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * DELETE /api/tenant/analytics?id=<id>
 * Delete report or export
 */
export async function DELETE(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "delete");
    const id = new URL(request.url).searchParams.get("id");
    const resourceType = new URL(request.url).searchParams.get("type") || "report";

    if (!id) {
      return errorResponse("ID is required", 400);
    }

    const auditService = new AuditService();
    await auditService.log(
      asTenantSlug(context.tenantSlug),
      context.userId as UserId,
      "delete",
      resourceType === "export" ? "export" : "report",
      id as ResourceId
    );

    return NextResponse.json({
      success: true,
      message: "Report deleted successfully",
    });
  } catch (error) {
    console.error("Analytics DELETE error:", error);
    return handleTenantAdminError(error);
  }
}
