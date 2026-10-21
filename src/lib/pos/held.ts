import { randomUUID } from "node:crypto";
import { sql as SQL } from "../sql-client";
import { ensureOnce } from "@/lib/ensure-once";

export function ensureHeldTables(...args: Parameters<typeof ensureRun>) {
  return ensureOnce("pos/held:ensure", () => ensureRun(...args));
}

async function ensureRun(sql = SQL) {
  await sql`
    create table if not exists pos_held_sales (
      id text primary key,
      tenant_slug text not null,
      register_id text,
      label text,
      cart jsonb not null,
      customer_code text,
      created_by text,
      created_at timestamptz not null default now()
    )
  `;
}

export async function holdSale(
  tenantSlug: string,
  input: { label?: string; cart: unknown; customerCode?: string; registerId?: string; createdBy?: string }
) {
  const sql = SQL;
  await ensureHeldTables(sql);
  const id = `held_${randomUUID().slice(0, 10)}`;
  await sql`
    insert into pos_held_sales (id, tenant_slug, register_id, label, cart, customer_code, created_by)
    values (${id}, ${tenantSlug}, ${input.registerId ?? null}, ${input.label ?? null},
            ${JSON.stringify(input.cart)}, ${input.customerCode ?? null}, ${input.createdBy ?? null})
  `;
  return { id };
}

export async function listHeldSales(tenantSlug: string, registerId?: string | null) {
  const sql = SQL;
  await ensureHeldTables(sql);
  const rows = (await sql`
    select * from pos_held_sales
    where tenant_slug = ${tenantSlug}
      and (${registerId ?? null}::text is null or register_id = ${registerId ?? null})
    order by created_at
  `) as any[];
  return rows.map((r) => ({
    id: r.id, registerId: r.register_id, label: r.label,
    cart: typeof r.cart === "string" ? JSON.parse(r.cart) : r.cart,
    customerCode: r.customer_code, createdBy: r.created_by, createdAt: r.created_at,
  }));
}

export async function deleteHeldSale(tenantSlug: string, id: string) {
  const sql = SQL;
  await ensureHeldTables(sql);
  const res = (await sql`
    delete from pos_held_sales where id = ${id} and tenant_slug = ${tenantSlug} returning id
  `) as any[];
  return res.length > 0;
}
