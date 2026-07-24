import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CRM_LEAD_STAGES, CRM_LEAD_SOURCES } from "@/lib/crm/types";
import { insertLead, listLeads, countLeads } from "@/lib/crm/db";
import { handleDatabaseError } from "@/lib/api-errors";
import { resolveCrmAuth } from "@/lib/crm/auth";
import { sql as SQL, db } from "@/lib/sql-client";

const leadSchema = z.object({
  tenantSlug: z.string().min(1),
  regionId: z.string().min(1),
  branchId: z.string().min(1),
  companyName: z.string().min(2),
  contactName: z.string().min(2),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  owner: z.string().optional(),
  stage: z.enum(CRM_LEAD_STAGES),
  source: z.enum(CRM_LEAD_SOURCES).default("website"),
  expectedValue: z.number().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
});

async function getTeamMemberIds(tenantSlug: string, departmentId: string, selfId: string): Promise<string[]> {
  if (!departmentId) return [];
  const sql = SQL;
  const rows = await sql`
    select id from admin_employees
    where tenant_slug = ${tenantSlug} and department_id = ${departmentId} and status = 'active'
  `;
  return (rows as any[]).map(r => r.id);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const auth = await resolveCrmAuth(request);
  const createdBy = auth?.employeeId;

  try {
    const lead = await insertLead({
      tenantSlug: parsed.data.tenantSlug,
      regionId: parsed.data.regionId,
      branchId: parsed.data.branchId,
      companyName: parsed.data.companyName,
      contactName: parsed.data.contactName,
      contactEmail: parsed.data.contactEmail,
      contactPhone: parsed.data.contactPhone,
      source: parsed.data.source,
      stage: parsed.data.stage,
      assignedOfficerId: parsed.data.owner || createdBy,
      expectedValue: parsed.data.expectedValue,
      currency: parsed.data.currency,
      notes: parsed.data.notes,
      createdBy,
    });

    return NextResponse.json({ lead });
  } catch (error) {
    return handleDatabaseError(error, "Lead creation");
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  const regionId = searchParams.get("regionId") || undefined;
  const branchId = searchParams.get("branchId") || undefined;
  const salesOfficerId = searchParams.get("salesOfficerId") || undefined;
  const stage = searchParams.get("stage") || undefined;
  const source = searchParams.get("source") || undefined;
  const search = searchParams.get("search") || undefined;
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;
  const offset = searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined;
  const viewMode = searchParams.get("viewMode") || undefined;

  const auth = await resolveCrmAuth(request);

  try {
    let filterCreatedBy: string | undefined;
    let filterSalesOfficerId = salesOfficerId;

    if (auth && auth.session.tenantSlug === tenantSlug) {
      if (viewMode === "mine" || (!viewMode && auth.scope === "mine")) {
        filterCreatedBy = auth.employeeId;
      } else if (viewMode === "team" || (!viewMode && auth.scope === "team")) {
        const teamIds = await getTeamMemberIds(auth.session.tenantSlug, auth.departmentId, auth.employeeId);
        if (teamIds.length > 0) {
          const placeholders = teamIds.map((_, i) => `$${i + 2}`).join(",");
          const rows = (await db.query(
            `select * from crm_leads where tenant_slug = $1 and created_by in (${placeholders}) order by created_at desc`,
            [tenantSlug, ...teamIds]
          )).rows as any[];
          const leads = rows.map((r) => ({
            id: r.id, tenantSlug: r.tenant_slug, regionId: r.region_id, branchId: r.branch_id,
            companyName: r.company_name, contactName: r.contact_name, contactEmail: r.contact_email,
            contactPhone: r.contact_phone, source: r.source, stage: r.stage, score: Number(r.score ?? 0),
            assignedOfficerId: r.assigned_officer_id, expectedValue: r.expected_value ? Number(r.expected_value) : null,
            currency: r.currency, notes: r.notes, createdBy: r.created_by ?? null,
            createdAt: r.created_at, updatedAt: r.updated_at,
          }));
          return NextResponse.json({ leads, total: leads.length });
        }
        filterCreatedBy = auth.employeeId;
      }
    }

    const leads = await listLeads({ tenantSlug, regionId, branchId, salesOfficerId: filterSalesOfficerId, stage, source, search, limit, offset, createdBy: filterCreatedBy } as any);
    const total = await countLeads({ tenantSlug, regionId, branchId, salesOfficerId: filterSalesOfficerId, stage, source, search, createdBy: filterCreatedBy } as any);
    return NextResponse.json({ leads, total });
  } catch (error) {
    return handleDatabaseError(error, "List leads");
  }
}
