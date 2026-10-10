/**
 * Ask-your-data: a registry of named, parameterized, read-only queries the
 * agent can run in response to natural-language questions. No generated
 * SQL ever reaches the database — every query is a fixed tagged template
 * with bound parameters.
 */

export interface DataQuery {
  name: string;
  description: string;
  params?: { name: string; required: boolean; description: string; default?: unknown }[];
  run: (tenantSlug: string, params: Record<string, unknown>) => Promise<unknown[]>;
  format: (rows: unknown[]) => string;
}

async function db() {
  const { sql } = await import("@/lib/sql-client");
  return sql;
}

export const DATA_QUERIES: DataQuery[] = [
  {
    name: "report_compliance",
    description: "Employees who haven't submitted a staff report in N days (default 5)",
    params: [{ name: "days", required: false, description: "Days without a report (default 5)", default: 5 }],
    async run(tenantSlug, params) {
      const sql = await db();
      const days = Math.min(Math.max(Number(params.days) || 5, 1), 90);
      const cutoff = new Date(Date.now() - days * 86400000).toISOString();
      return await sql`
        select e.id, e.name, e.job_title, d.name as department,
               (select max(submitted_at) from admin_staff_reports r where r.employee_id = e.id and r.tenant_slug = ${tenantSlug}) as last_report_at
        from admin_employees e
        left join admin_departments d on d.id = e.department_id
        where e.tenant_slug = ${tenantSlug} and e.status = 'active'
          and not exists (
            select 1 from admin_staff_reports r
            where r.employee_id = e.id and r.tenant_slug = ${tenantSlug} and r.submitted_at >= ${cutoff}
          )
        order by last_report_at asc nulls first limit 50
      `;
    },
    format(rows: any[]) {
      if (!rows.length) return "Everyone has submitted a report within the window.";
      const lines = rows.slice(0, 10).map((r) => `• ${r.name}${r.department ? ` (${r.department})` : ""} — last report ${r.last_report_at ? new Date(r.last_report_at).toLocaleDateString() : "never"}`);
      return `${rows.length} employee(s) haven't reported recently:\n${lines.join("\n")}`;
    },
  },
  {
    name: "department_headcount",
    description: "Active employee count per department",
    async run(tenantSlug) {
      const sql = await db();
      return await sql`
        select coalesce(d.name, 'Unassigned') as department, count(*) as employees
        from admin_employees e
        left join admin_departments d on d.id = e.department_id
        where e.tenant_slug = ${tenantSlug} and e.status = 'active'
        group by 1 order by employees desc limit 30
      `;
    },
    format(rows: any[]) {
      const total = rows.reduce((s, r) => s + Number(r.employees), 0);
      return `${total} active employee(s) across ${rows.length} department(s):\n` +
        rows.map((r) => `• ${r.department}: ${r.employees}`).join("\n");
    },
  },
  {
    name: "pipeline_summary",
    description: "Open CRM deals count and total value grouped by stage",
    async run(tenantSlug) {
      const sql = await db();
      return await sql`
        select stage, count(*) as deals, coalesce(sum(value),0) as total_value, currency
        from crm_deals
        where tenant_slug = ${tenantSlug} and coalesce(status,'open') not in ('won','lost','closed')
        group by stage, currency order by total_value desc limit 20
      `;
    },
    format(rows: any[]) {
      if (!rows.length) return "No open deals in the pipeline.";
      return "Open pipeline by stage:\n" +
        rows.map((r) => `• ${r.stage}: ${r.deals} deal(s) worth ${Number(r.total_value).toLocaleString()} ${r.currency || ""}`.trim()).join("\n");
    },
  },
  {
    name: "overdue_tasks",
    description: "Staff tasks past their due date, grouped by employee",
    async run(tenantSlug) {
      const sql = await db();
      const today = new Date().toISOString().split("T")[0];
      return await sql`
        select e.name as employee, count(t.id) as overdue_tasks
        from admin_staff_tasks t
        join admin_employees e on e.id = t.employee_id
        where t.tenant_slug = ${tenantSlug} and t.due_date < ${today} and t.status != 'completed'
        group by e.name order by overdue_tasks desc limit 30
      `;
    },
    format(rows: any[]) {
      if (!rows.length) return "No overdue tasks.";
      return `${rows.reduce((s, r) => s + Number(r.overdue_tasks), 0)} overdue task(s):\n` +
        rows.map((r) => `• ${r.employee}: ${r.overdue_tasks}`).join("\n");
    },
  },
  {
    name: "outstanding_invoices",
    description: "Unpaid invoice totals and count, grouped by customer",
    async run(tenantSlug) {
      const sql = await db();
      return await sql`
        select customer_name, count(*) as invoices, coalesce(sum(balance_due),0) as balance_due, currency
        from finance_invoices
        where tenant_slug = ${tenantSlug} and coalesce(balance_due,0) > 0
        group by customer_name, currency order by balance_due desc limit 30
      `;
    },
    format(rows: any[]) {
      if (!rows.length) return "No outstanding invoices.";
      const grand = rows.reduce((s, r) => s + Number(r.balance_due), 0);
      return `Outstanding receivables (${grand.toLocaleString()} total):\n` +
        rows.slice(0, 10).map((r) => `• ${r.customer_name}: ${Number(r.balance_due).toLocaleString()} ${r.currency || ""} across ${r.invoices} invoice(s)`.trim()).join("\n");
    },
  },
  {
    name: "leave_today",
    description: "Employees on approved leave right now",
    async run(tenantSlug) {
      const sql = await db();
      const today = new Date().toISOString().split("T")[0];
      return await sql`
        select employee_name, leave_type, start_date, end_date
        from admin_leave_requests
        where tenant_slug = ${tenantSlug} and status = 'approved'
          and start_date <= ${today} and end_date >= ${today}
        order by end_date asc limit 30
      `;
    },
    format(rows: any[]) {
      if (!rows.length) return "Nobody is on approved leave today.";
      return `On leave today (${rows.length}):\n` +
        rows.map((r) => `• ${r.employee_name} — ${r.leave_type} until ${new Date(r.end_date).toLocaleDateString()}`).join("\n");
    },
  },
  {
    name: "candidate_leaderboard",
    description: "Top candidates by AI screening score, optionally per requisition",
    params: [{ name: "requisitionId", required: false, description: "Filter to one requisition" }],
    async run(tenantSlug, params) {
      const sql = await db();
      const reqId = params.requisitionId ? String(params.requisitionId) : null;
      return await sql`
        select c.full_name, a.status, a.ai_score, c.experience_years
        from admin_applications a
        join admin_candidates c on c.id = a.candidate_id
        where a.tenant_slug = ${tenantSlug}
          and (${reqId}::text is null or a.requisition_id = ${reqId})
        order by a.ai_score desc nulls last limit 15
      `;
    },
    format(rows: any[]) {
      if (!rows.length) return "No candidates found.";
      return `Top candidates:\n` +
        rows.map((r, i) => `${i + 1}. ${r.full_name} — score ${r.ai_score ?? "unscored"}, ${r.status}${r.experience_years ? `, ${r.experience_years}y exp` : ""}`).join("\n");
    },
  },
];

export function getDataQuery(name: string): DataQuery | undefined {
  return DATA_QUERIES.find((q) => q.name === name);
}
