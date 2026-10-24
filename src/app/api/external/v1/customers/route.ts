export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authenticateExternal } from "@/lib/external/auth";
import { db, sql as SQL } from "@/lib/sql-client";
import { ensureCrmTables, insertCustomer } from "@/lib/crm/db";
import { getDefaultBranchId } from "@/lib/finance/branches";

const CustomerSchema = z.object({
  name: z.string().min(1).max(200),
  contactName: z.string().max(200).optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().max(40).optional(),
  industry: z.string().max(100).optional(),
  // External system's own id — retried posts return the original customer.
  externalId: z.string().max(120).optional(),
});

let externalIdEnsured = false;
async function ensureExternalIdColumn() {
  if (externalIdEnsured) return;
  await ensureCrmTables(SQL);
  await SQL`alter table crm_customers add column if not exists external_id text`;
  await SQL`create unique index if not exists crm_customers_external_uidx
            on crm_customers (tenant_slug, external_id) where external_id is not null`;
  externalIdEnsured = true;
}

/**
 * Push a customer into this tenant's CRM/customer master.
 * Headers: x-api-key (or Bearer) + x-tenant-slug.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateExternal(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = CustomerSchema.safeParse(body);
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
          `select id from crm_customers where tenant_slug = $1 and external_id = $2`,
          [auth.tenantSlug, input.externalId]
        )
      ).rows[0];
      if (existing) {
        return NextResponse.json({ customer: { id: existing.id }, duplicate: true });
      }
    }

    const branchId = (await getDefaultBranchId(auth.tenantSlug)) ?? "default";
    const primaryContact =
      input.contactName || input.contactEmail || input.contactPhone
        ? {
            name: input.contactName ?? "",
            email: input.contactEmail || undefined,
            phone: input.contactPhone,
          }
        : undefined;

    const customer = await insertCustomer({
      tenantSlug: auth.tenantSlug,
      regionId: "default",
      branchId,
      name: input.name,
      primaryContact,
      status: "active",
    });

    if (input.externalId) {
      await db.query(`update crm_customers set external_id = $2 where id = $1`, [
        customer.id,
        input.externalId,
      ]);
    }

    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    console.error("External customer create failed:", error);
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}
