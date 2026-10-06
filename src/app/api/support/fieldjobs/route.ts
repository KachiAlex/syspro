export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

async function ensureFieldJobsRun() {
  await SQL`
    create table if not exists it_field_jobs (
      id text primary key,
      tenant_slug text not null,
      ticket_id text,
      engineer_id text,
      engineer_name text,
      title text,
      site_address text,
      assigned_at timestamptz not null default now(),
      started_at timestamptz,
      arrived_at timestamptz,
      completed_at timestamptz,
      work_log text,
      images jsonb not null default '[]'::jsonb,
      customer_signoff boolean default false,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await SQL`create index if not exists idx_it_field_jobs_tenant on it_field_jobs (tenant_slug)`;
}

function ensureFieldJobs() {
  return ensureOnce("fieldjobs:ensureTable", ensureFieldJobsRun);
}

function mapJob(row: any) {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    engineerId: row.engineer_id,
    engineerName: row.engineer_name,
    title: row.title,
    siteAddress: row.site_address,
    assignedAt: row.assigned_at,
    startedAt: row.started_at,
    arrivedAt: row.arrived_at,
    completedAt: row.completed_at,
    workLog: row.work_log,
    images: row.images || [],
    customerSignoff: row.customer_signoff,
  };
}

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  await ensureFieldJobs();

  // Engineers see their own jobs; admins see everything for the tenant.
  const engineerOnly = context.userRole === "staff" || context.userRole === "viewer";
  const rows = engineerOnly && context.userId
    ? await SQL`
        select * from it_field_jobs
        where tenant_slug = ${context.tenantSlug} and engineer_id = ${context.userId}
        order by assigned_at desc limit 200
      `
    : await SQL`
        select * from it_field_jobs
        where tenant_slug = ${context.tenantSlug}
        order by assigned_at desc limit 200
      `;

  return NextResponse.json({ data: (Array.isArray(rows) ? rows : []).map(mapJob) });
}

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  const { ticketId, engineerId, engineerName, title, siteAddress } = body || {};

  await ensureFieldJobs();
  const id = randomUUID();
  const [row] = await SQL`
    insert into it_field_jobs (id, tenant_slug, ticket_id, engineer_id, engineer_name, title, site_address)
    values (${id}, ${context.tenantSlug}, ${ticketId || null}, ${engineerId || context.userId || null}, ${engineerName || null}, ${title || null}, ${siteAddress || null})
    returning *
  ` as any[];
  return NextResponse.json({ data: mapJob(row) }, { status: 201 });
}
