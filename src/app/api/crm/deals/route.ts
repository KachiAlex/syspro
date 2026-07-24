import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CRM_PIPELINE_STAGES } from "@/lib/crm/types";
import { insertDeal, listDeals, countDeals, logActivity } from "@/lib/crm/db";
import { handleDatabaseError } from "@/lib/api-errors";
import { resolveCrmAuth } from "@/lib/crm/auth";
import { sql as SQL, db } from "@/lib/sql-client";

const dealSchema = z.object({
  tenantSlug: z.string().min(1),
  customerId: z.string().optional(),
  leadId: z.string().optional(),
  contactId: z.string().optional(),
  name: z.string().optional(),
  stage: z.enum(CRM_PIPELINE_STAGES),
  value: z.number().positive(),
  currency: z.string().optional(),
  probability: z.number().min(0).max(100).optional(),
  expectedClose: z.string().optional(),
  assignedOfficerId: z.string().optional(),
  status: z.string().optional(),
});

async function getTeamMemberIds(tenantSlug: string, departmentId: string): Promise<string[]> {
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

  const parsed = dealSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const auth = await resolveCrmAuth(request);
  const createdBy = auth?.employeeId;

  try {
    const deal = await insertDeal({
      tenantSlug: parsed.data.tenantSlug,
      customerId: parsed.data.customerId,
      leadId: parsed.data.leadId,
      contactId: parsed.data.contactId,
      name: parsed.data.name,
      stage: parsed.data.stage,
      value: parsed.data.value,
      currency: parsed.data.currency,
      probability: parsed.data.probability,
      expectedClose: parsed.data.expectedClose,
      assignedOfficerId: parsed.data.assignedOfficerId || createdBy,
      status: parsed.data.status,
      createdBy,
    });

    await logActivity({
      tenantSlug: parsed.data.tenantSlug,
      entityType: "deal",
      entityId: deal.id,
      action: "deal_created",
      description: `Deal "${parsed.data.name || 'Untitled'}" created (${parsed.data.stage})`,
      metadata: { leadId: parsed.data.leadId, customerId: parsed.data.customerId, value: parsed.data.value },
    }).catch(() => {});

    return NextResponse.json({ deal });
  } catch (error) {
    return handleDatabaseError(error, "Deal creation");
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }
  const customerId = url.searchParams.get("customerId") || undefined;
  const leadId = url.searchParams.get("leadId") || undefined;
  const stage = url.searchParams.get("stage") || undefined;
  const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
  const offset = url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : undefined;
  const viewMode = url.searchParams.get("viewMode") || undefined;

  const auth = await resolveCrmAuth(request);

  try {
    let filterCreatedBy: string | undefined;

    if (auth && auth.session.tenantSlug === tenantSlug) {
      if (viewMode === "mine" || (!viewMode && auth.scope === "mine")) {
        filterCreatedBy = auth.employeeId;
      } else if (viewMode === "team" || (!viewMode && auth.scope === "team")) {
        const teamIds = await getTeamMemberIds(auth.session.tenantSlug, auth.departmentId);
        if (teamIds.length > 0) {
          const placeholders = teamIds.map((_, i) => `$${i + 2}`).join(",");
          const rows = (await db.query(
            `select * from crm_deals where tenant_slug = $1 and created_by in (${placeholders}) order by created_at desc`,
            [tenantSlug, ...teamIds]
          )).rows as any[];
          const deals = rows.map((r) => ({
            id: r.id, tenantSlug: r.tenant_slug, customerId: r.customer_id, leadId: r.lead_id,
            contactId: r.contact_id ?? null, name: r.name ?? null, stage: r.stage,
            value: Number(r.value ?? 0), currency: r.currency, probability: r.probability ? Number(r.probability) : null,
            expectedClose: r.expected_close, assignedOfficerId: r.assigned_officer_id, status: r.status,
            createdBy: r.created_by ?? null, createdAt: r.created_at, updatedAt: r.updated_at,
          }));
          return NextResponse.json({ deals, total: deals.length });
        }
        filterCreatedBy = auth.employeeId;
      }
    }

    const deals = await listDeals({ tenantSlug, customerId, leadId, stage, limit, offset, createdBy: filterCreatedBy });
    const total = await countDeals({ tenantSlug, customerId, leadId, stage, createdBy: filterCreatedBy });
    return NextResponse.json({ deals, total });
  } catch (error) {
    return handleDatabaseError(error, "List deals");
  }
}
