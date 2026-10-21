import { randomUUID } from "node:crypto";
import { sql as SQL, db } from "../sql-client";
import { ensureOnce } from "@/lib/ensure-once";

export function ensureSalaryStructureTables(...args: Parameters<typeof run>) {
  return ensureOnce("hr/salary-structure:ensure", () => run(...args));
}

async function run(sql = SQL) {
  await sql`
    create table if not exists admin_salary_structures (
      id text primary key,
      tenant_slug text not null,
      name text not null,
      effective_from date,
      is_active boolean not null default true,
      created_at timestamptz default now(),
      unique (tenant_slug, name)
    )
  `;
  await sql`
    create table if not exists admin_salary_structure_components (
      id text primary key,
      tenant_slug text not null,
      structure_id text not null references admin_salary_structures(id) on delete cascade,
      name text not null,
      component_type text not null check (component_type in ('earning','deduction')),
      amount_type text not null default 'fixed' check (amount_type in ('fixed','percent_of_base')),
      amount numeric(15,2) not null,
      created_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_ssc_structure on admin_salary_structure_components(tenant_slug, structure_id)`;
}

export async function listSalaryStructures(tenantSlug: string) {
  const sql = SQL;
  await ensureSalaryStructureTables(sql);
  const structures = (await sql`
    select * from admin_salary_structures where tenant_slug = ${tenantSlug} order by name
  `) as any[];
  const components = (await sql`
    select * from admin_salary_structure_components where tenant_slug = ${tenantSlug} order by created_at
  `) as any[];
  return structures.map((s) => ({
    id: s.id,
    name: s.name,
    effectiveFrom: s.effective_from,
    isActive: s.is_active,
    components: components
      .filter((c) => c.structure_id === s.id)
      .map((c) => ({
        id: c.id,
        name: c.name,
        componentType: c.component_type,
        amountType: c.amount_type,
        amount: Number(c.amount),
      })),
  }));
}

export async function upsertSalaryStructure(
  tenantSlug: string,
  input: {
    id?: string;
    name: string;
    effectiveFrom?: string;
    isActive?: boolean;
    components: Array<{ name: string; componentType: "earning" | "deduction"; amountType?: "fixed" | "percent_of_base"; amount: number }>;
  }
) {
  const sql = SQL;
  await ensureSalaryStructureTables(sql);
  const id = input.id ?? randomUUID();
  await sql`
    insert into admin_salary_structures (id, tenant_slug, name, effective_from, is_active)
    values (${id}, ${tenantSlug}, ${input.name}, ${input.effectiveFrom ?? null}, ${input.isActive ?? true})
    on conflict (id) do update set
      name = excluded.name, effective_from = excluded.effective_from, is_active = excluded.is_active
  `;
  await sql`delete from admin_salary_structure_components where tenant_slug = ${tenantSlug} and structure_id = ${id}`;
  for (const c of input.components) {
    await sql`
      insert into admin_salary_structure_components (id, tenant_slug, structure_id, name, component_type, amount_type, amount)
      values (${randomUUID()}, ${tenantSlug}, ${id}, ${c.name}, ${c.componentType}, ${c.amountType ?? "fixed"}, ${c.amount})
    `;
  }
  return (await listSalaryStructures(tenantSlug)).find((s) => s.id === id);
}

/**
 * Apply a structure to employees: copies its components into
 * admin_employee_components as recurring, active rows. Existing rows with the
 * same name+type are replaced so re-applying doesn't duplicate.
 */
export async function applySalaryStructure(
  tenantSlug: string,
  structureId: string,
  employeeIds: string[],
  appliedBy?: string
): Promise<{ applied: number } | { error: string }> {
  const sql = SQL;
  await ensureSalaryStructureTables(sql);
  const [structure] = (await sql`
    select * from admin_salary_structures where id = ${structureId} and tenant_slug = ${tenantSlug}
  `) as any[];
  if (!structure) return { error: "Salary structure not found" };

  const components = (await sql`
    select * from admin_salary_structure_components where tenant_slug = ${tenantSlug} and structure_id = ${structureId}
  `) as any[];
  if (!components.length) return { error: "Structure has no components" };

  const employees = (await db.query(
    `select id, name from admin_employees where tenant_slug = $1 and id = any($2)`,
    [tenantSlug, employeeIds]
  )).rows;
  if (!employees.length) return { error: "No matching employees" };

  let applied = 0;
  for (const emp of employees) {
    for (const c of components) {
      await sql`
        delete from admin_employee_components
        where tenant_slug = ${tenantSlug} and employee_id = ${emp.id}
          and name = ${c.name} and component_type = ${c.component_type} and is_recurring
      `;
      await sql`
        insert into admin_employee_components (
          id, tenant_slug, employee_id, employee_name, name, component_type,
          amount_type, amount, is_recurring, is_active, created_by
        ) values (
          ${randomUUID()}, ${tenantSlug}, ${emp.id}, ${emp.name}, ${c.name},
          ${c.component_type}, ${c.amount_type}, ${c.amount}, true, true, ${appliedBy ?? "system"}
        )
      `;
      applied++;
    }
  }
  try {
    const { logAuditAction } = await import("../audit");
    await logAuditAction("salary_structure.applied", "salary_structure", structureId,
      { employeeIds, applied }, tenantSlug, undefined, appliedBy);
  } catch { /* audit must not block */ }
  return { applied };
}
