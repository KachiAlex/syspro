import { db } from "@/lib/sql-client";

// Finance edge features: party links (customer↔supplier↔employee relations)
// and advance taxes (WHT/taxes applied to advance payment entries).

// ── Party links ────────────────────────────────────────────────────────────

export async function listPartyLinks(tenantSlug: string, partyType?: string, partyId?: string) {
  const conds = ["tenant_slug = $1"];
  const params: any[] = [tenantSlug];
  if (partyType) { params.push(partyType); conds.push(`primary_type = $${params.length}`); }
  if (partyId) { params.push(partyId); conds.push(`primary_id = $${params.length}`); }
  return (await db.query<any>(
    `select * from party_links where ${conds.join(" and ")} order by created_at desc`,
    params
  )).rows;
}

export async function createPartyLink(input: {
  tenantSlug: string;
  primaryType: string;
  primaryId: string;
  secondaryType: string;
  secondaryId: string;
  createdBy?: string;
}) {
  const types = ["customer", "supplier", "employee", "shareholder"];
  if (!types.includes(input.primaryType) || !types.includes(input.secondaryType))
    throw new Error("party types must be customer|supplier|employee|shareholder");
  return (await db.query<any>(
    `insert into party_links (tenant_slug, primary_type, primary_id,
       secondary_type, secondary_id, created_by)
     values ($1,$2,$3,$4,$5,$6)
     on conflict do nothing returning *`,
    [input.tenantSlug, input.primaryType, input.primaryId,
     input.secondaryType, input.secondaryId, input.createdBy ?? null]
  )).rows[0];
}

export async function deletePartyLink(tenantSlug: string, id: string) {
  await db.query(
    `delete from party_links where id = $1 and tenant_slug = $2`,
    [id, tenantSlug]
  );
}

/** Customers who are also suppliers — usable for AR/AP contra netting. */
export async function getContraPartners(tenantSlug: string) {
  return (await db.query<any>(
    `select pl.*, c.name as customer_name, v.display_name as supplier_name
     from party_links pl
     left join finance_customers c
       on c.id::text = pl.primary_id and pl.primary_type = 'customer'
     left join vendors v
       on v.id = pl.secondary_id and pl.secondary_type = 'supplier'
     where pl.tenant_slug = $1
       and ((pl.primary_type = 'customer' and pl.secondary_type = 'supplier')
         or (pl.primary_type = 'supplier' and pl.secondary_type = 'customer'))`,
    [tenantSlug]
  )).rows;
}

// ── Advance taxes ──────────────────────────────────────────────────────────

export async function listAdvanceTaxes(tenantSlug: string, paymentId?: string) {
  return (await db.query<any>(
    `select * from advance_taxes where tenant_slug = $1
     ${paymentId ? "and payment_id = $2" : ""} order by created_at desc`,
    paymentId ? [tenantSlug, paymentId] : [tenantSlug]
  )).rows;
}

export async function addAdvanceTax(input: {
  tenantSlug: string;
  paymentId: string;
  taxCode: string;
  description?: string;
  rate: number;
  taxAmount: number;
  accountCode?: string;
}) {
  if (input.taxAmount < 0) throw new Error("tax amount cannot be negative");
  return (await db.query<any>(
    `insert into advance_taxes (tenant_slug, payment_id, tax_code, description,
       rate, tax_amount, account_code)
     values ($1,$2,$3,$4,$5,$6,$7) returning *`,
    [input.tenantSlug, input.paymentId, input.taxCode, input.description ?? null,
     input.rate, input.taxAmount, input.accountCode ?? null]
  )).rows[0];
}

export async function removeAdvanceTax(tenantSlug: string, id: string) {
  await db.query(
    `delete from advance_taxes where id = $1 and tenant_slug = $2`,
    [id, tenantSlug]
  );
}
