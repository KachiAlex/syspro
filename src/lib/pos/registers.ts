import { randomUUID } from "node:crypto";
import { sql as SQL } from "../sql-client";
import { ensureOnce } from "@/lib/ensure-once";

export function ensureRegisterTables(...args: Parameters<typeof ensureRun>) {
  return ensureOnce("pos/registers:ensure", () => ensureRun(...args));
}

async function ensureRun(sql = SQL) {
  await sql`
    create table if not exists pos_registers (
      id text primary key,
      tenant_slug text not null,
      code text not null,
      name text not null,
      warehouse_id text,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      unique (tenant_slug, code)
    )
  `;
}

export interface PosRegister {
  id: string;
  code: string;
  name: string;
  warehouseId: string | null;
  isActive: boolean;
  createdAt: string;
}

function normalize(r: any): PosRegister {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    warehouseId: r.warehouse_id,
    isActive: r.is_active,
    createdAt: r.created_at,
  };
}

export async function listRegisters(tenantSlug: string, includeInactive = false): Promise<PosRegister[]> {
  const sql = SQL;
  await ensureRegisterTables(sql);
  const rows = (await sql`
    select * from pos_registers
    where tenant_slug = ${tenantSlug} and (${includeInactive} or is_active)
    order by code
  `) as any[];
  return rows.map(normalize);
}

export async function createRegister(
  tenantSlug: string,
  input: { code: string; name: string; warehouseId?: string }
): Promise<PosRegister> {
  const sql = SQL;
  await ensureRegisterTables(sql);
  const id = `reg_${randomUUID().slice(0, 10)}`;
  const rows = (await sql`
    insert into pos_registers (id, tenant_slug, code, name, warehouse_id)
    values (${id}, ${tenantSlug}, ${input.code.trim().toUpperCase()}, ${input.name.trim()}, ${input.warehouseId ?? null})
    on conflict (tenant_slug, code) do nothing
    returning *
  `) as any[];
  if (!rows.length) throw new Error(`Register code "${input.code}" already exists`);
  return normalize(rows[0]);
}

export async function setRegisterActive(tenantSlug: string, id: string, active: boolean): Promise<void> {
  const sql = SQL;
  await ensureRegisterTables(sql);
  await sql`
    update pos_registers set is_active = ${active}
    where id = ${id} and tenant_slug = ${tenantSlug}
  `;
}

export async function getRegister(tenantSlug: string, registerId?: string | null): Promise<PosRegister | null> {
  if (!registerId) return null;
  const sql = SQL;
  await ensureRegisterTables(sql);
  const rows = (await sql`
    select * from pos_registers where id = ${registerId} and tenant_slug = ${tenantSlug} and is_active
  `) as any[];
  return rows[0] ? normalize(rows[0]) : null;
}
