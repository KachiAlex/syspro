export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authenticateExternal } from "@/lib/external/auth";
import { db, sql as SQL } from "@/lib/sql-client";
import { ensureCrmTables, insertLead } from "@/lib/crm/db";
import { CRM_LEAD_STAGES, type CrmLeadSource, type CrmLeadStage } from "@/lib/crm/types";
import { getDefaultBranchId } from "@/lib/finance/branches";

const LeadSchema = z.object({
  companyName: z.string().min(1).max(200),
  contactName: z.string().min(1).max(200),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().max(40).optional(),
  stage: z.enum(CRM_LEAD_STAGES as unknown as [string, ...string[]]).optional(),
  source: z.string().max(60).optional(),
  expectedValue: z.number().nonnegative().optional(),
  currency: z.string().max(8).optional(),
  notes: z.string().max(4000).optional(),
  // External system's own id — retried posts return the original lead.
  externalId: z.string().max(120).optional(),
});

let externalIdEnsured = false;
async function ensureExternalIdColumn() {
  if (externalIdEnsured) return;
  await ensureCrmTables(SQL);
  await SQL`alter table crm_leads add column if not exists external_id text`;
  await SQL`create unique index if not exists crm_leads_external_uidx
            on crm_leads (tenant_slug, external_id) where external_id is not null`;
  externalIdEnsured = true;
}

/**
 * Push a lead into this tenant's CRM.
 * Headers: x-api-key (or Bearer) + x-tenant-slug.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateExternal(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = LeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;

  try {
    await ensureExternalIdColumn();

    if (input.externalId) {
      const existing = (
        await db.query<any>(
          `select id from crm_leads where tenant_slug = $1 and external_id = $2`,
          [auth.tenantSlug, input.externalId]
        )
      ).rows[0];
      if (existing) {
        return NextResponse.json({ lead: { id: existing.id }, duplicate: true });
      }
    }

    const branchId = (await getDefaultBranchId(auth.tenantSlug)) ?? "default";
    const stage = CRM_LEAD_STAGES.includes(input.stage as CrmLeadStage)
      ? (input.stage as CrmLeadStage)
      : "new";

    const lead = await insertLead({
      tenantSlug: auth.tenantSlug,
      regionId: "default",
      branchId,
      companyName: input.companyName,
      contactName: input.contactName,
      contactEmail: input.contactEmail || undefined,
      contactPhone: input.contactPhone,
      source: (input.source as CrmLeadSource) ?? "api_import",
      stage,
      expectedValue: input.expectedValue,
      currency: input.currency,
      notes: input.notes,
      createdBy: `api:${auth.keyId}`,
    });

    if (input.externalId) {
      await db.query(`update crm_leads set external_id = $2 where id = $1`, [
        lead.id,
        input.externalId,
      ]);
    }

    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    console.error("External lead create failed:", error);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}
