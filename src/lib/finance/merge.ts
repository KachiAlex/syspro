import { randomUUID } from "crypto";
import { sql as SQL, db } from "../sql-client";

/**
 * Document merge — consolidates a duplicate customer/vendor into the
 * canonical record by rewriting every foreign-key reference, then marks
 * the source merged (never deleted — history stays intact and the merge
 * row in document_merges is the audit trail). Irreversible → always
 * gated through the approvals engine.
 */

export async function ensureMergeTables(sql: any = SQL) {
  await sql`
    create table if not exists document_merges (
      id text primary key,
      tenant_slug text not null,
      doc_type text not null check (doc_type in ('customer','vendor')),
      source_id text not null,
      target_id text not null,
      rewrote jsonb not null default '{}',
      created_by text,
      created_at timestamptz not null default now()
    )
  `;
  await sql`alter table if exists finance_customers add column if not exists merged_into text`;
  await sql`alter table if exists vendors add column if not exists merged_into text`;
}

const CUSTOMER_REFS: { table: string; column: string }[] = [
  { table: "finance_invoices", column: "customer_id" },
  { table: "sales_orders", column: "customer_id" },
  { table: "crm_deals", column: "customer_id" },
  { table: "finance_payments", column: "customer_id" },
  { table: "crm_contacts", column: "customer_id" },
  { table: "crm_leads", column: "customer_id" },
  { table: "sales_quotations", column: "customer_id" },
  { table: "delivery_notes", column: "customer_id" },
];

const VENDOR_REFS: { table: string; column: string }[] = [
  { table: "bills", column: "vendor_id" },
  { table: "purchase_orders", column: "vendor_id" },
  { table: "purchase_orders", column: "supplier_id" },
  { table: "vendor_payments", column: "vendor_id" },
  { table: "purchase_receipts", column: "vendor_id" },
  { table: "procurement_goods_receipts", column: "vendor_id" },
  { table: "vendor_contacts", column: "vendor_id" },
];

async function rewriteRefs(
  sql: any, tenantSlug: string,
  refs: { table: string; column: string }[],
  sourceId: string, targetId: string
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const ref of refs) {
    try {
      const res = await db.query(
        `update ${ref.table} set ${ref.column} = $1
         where ${ref.column} = $2 and tenant_slug = $3`,
        [targetId, sourceId, tenantSlug]
      );
      const n = res.rowCount ?? 0;
      if (n) counts[`${ref.table}.${ref.column}`] = n;
    } catch {
      // Table/column may not exist in this deployment — skip, don't fail.
    }
  }
  return counts;
}

export async function mergeCustomer(input: {
  tenantSlug: string; sourceId: string; targetId: string; createdBy?: string;
}) {
  const sql = SQL;
  await ensureMergeTables(sql);
  if (input.sourceId === input.targetId) throw new Error("Cannot merge a record into itself");

  const [target] = (await sql`
    select id, name from finance_customers where id = ${input.targetId} and tenant_slug = ${input.tenantSlug}
  `) as any[];
  const [source] = (await sql`
    select id, name from finance_customers where id = ${input.sourceId} and tenant_slug = ${input.tenantSlug}
  `) as any[];
  if (!target) throw new Error("Target customer not found");
  if (!source) throw new Error("Source customer not found");

  const rewrote = await rewriteRefs(sql, input.tenantSlug, CUSTOMER_REFS, input.sourceId, input.targetId);
  await sql`
    update finance_customers set merged_into = ${input.targetId}, updated_at = now()
    where id = ${input.sourceId} and tenant_slug = ${input.tenantSlug}
  `;
  const id = `merge_${randomUUID().slice(0, 12)}`;
  await sql`
    insert into document_merges (id, tenant_slug, doc_type, source_id, target_id, rewrote, created_by)
    values (${id}, ${input.tenantSlug}, 'customer', ${input.sourceId}, ${input.targetId},
            ${JSON.stringify(rewrote)}, ${input.createdBy ?? null})
  `;
  return { id, rewrote };
}

export async function mergeVendor(input: {
  tenantSlug: string; sourceId: string; targetId: string; createdBy?: string;
}) {
  const sql = SQL;
  await ensureMergeTables(sql);
  if (input.sourceId === input.targetId) throw new Error("Cannot merge a record into itself");

  const [target] = (await sql`
    select id, name from vendors where id = ${input.targetId} and tenant_slug = ${input.tenantSlug}
  `) as any[];
  const [source] = (await sql`
    select id, name from vendors where id = ${input.sourceId} and tenant_slug = ${input.tenantSlug}
  `) as any[];
  if (!target) throw new Error("Target vendor not found");
  if (!source) throw new Error("Source vendor not found");

  const rewrote = await rewriteRefs(sql, input.tenantSlug, VENDOR_REFS, input.sourceId, input.targetId);
  await sql`
    update vendors set merged_into = ${input.targetId}
    where id = ${input.sourceId} and tenant_slug = ${input.tenantSlug}
  `;
  const id = `merge_${randomUUID().slice(0, 12)}`;
  await sql`
    insert into document_merges (id, tenant_slug, doc_type, source_id, target_id, rewrote, created_by)
    values (${id}, ${input.tenantSlug}, 'vendor', ${input.sourceId}, ${input.targetId},
            ${JSON.stringify(rewrote)}, ${input.createdBy ?? null})
  `;
  return { id, rewrote };
}
