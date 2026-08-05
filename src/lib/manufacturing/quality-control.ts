import { randomUUID } from "crypto";
import { sql as SQL, SqlClient } from "../sql-client";

export interface QualityInspection {
  id: string;
  tenantSlug: string;
  workOrderId: string;
  inspectionNumber: string;
  inspector: string;
  result: "pass" | "fail" | "conditional";
  defectsFound: number;
  unitsInspected: number;
  unitsRejected: number;
  defectTypes: string[];
  notes: string | null;
  inspectedAt: string;
  createdAt: string;
}

export async function ensureQualityTables(sql: SqlClient = SQL) {
  await sql`
    create table if not exists quality_inspections (
      id text primary key,
      tenant_slug text not null,
      work_order_id text not null,
      inspection_number text not null,
      inspector text not null,
      result text not null check (result in ('pass', 'fail', 'conditional')),
      defects_found integer not null default 0,
      units_inspected integer not null default 0,
      units_rejected integer not null default 0,
      defect_types text[] default array[]::text[],
      notes text,
      inspected_at timestamptz default now(),
      created_at timestamptz default now()
    )
  `;
  await sql`create index if not exists quality_inspections_tenant_idx on quality_inspections (tenant_slug)`;
  await sql`create index if not exists quality_inspections_wo_idx on quality_inspections (work_order_id)`;
}

export async function createInspection(data: {
  tenantSlug: string;
  workOrderId: string;
  inspector: string;
  result: string;
  defectsFound?: number;
  unitsInspected?: number;
  unitsRejected?: number;
  defectTypes?: string[];
  notes?: string;
}): Promise<QualityInspection> {
  const sql = SQL;
  await ensureQualityTables(sql);

  const id = randomUUID();
  const now = new Date();
  const inspectionNumber = `QI-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${id.slice(0, 6).toUpperCase()}`;

  const [row] = (await sql`
    insert into quality_inspections (
      id, tenant_slug, work_order_id, inspection_number, inspector, result,
      defects_found, units_inspected, units_rejected, defect_types, notes, inspected_at, created_at
    )
    values (
      ${id}, ${data.tenantSlug}, ${data.workOrderId}, ${inspectionNumber}, ${data.inspector}, ${data.result},
      ${data.defectsFound ?? 0}, ${data.unitsInspected ?? 0}, ${data.unitsRejected ?? 0},
      ${data.defectTypes ?? []}, ${data.notes ?? null}, ${now}, ${now}
    )
    returning *
  `) as any[];

  return normalizeInspection(row);
}

export async function listInspections(tenantSlug: string, workOrderId?: string): Promise<QualityInspection[]> {
  const sql = SQL;
  await ensureQualityTables(sql);

  const rows = workOrderId
    ? (await sql`select * from quality_inspections where tenant_slug = ${tenantSlug} and work_order_id = ${workOrderId} order by created_at desc`)
    : (await sql`select * from quality_inspections where tenant_slug = ${tenantSlug} order by created_at desc`);

  return (rows as any[]).map(normalizeInspection);
}

function normalizeInspection(row: any): QualityInspection {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    workOrderId: row.work_order_id,
    inspectionNumber: row.inspection_number,
    inspector: row.inspector,
    result: row.result,
    defectsFound: row.defects_found,
    unitsInspected: row.units_inspected,
    unitsRejected: row.units_rejected,
    defectTypes: row.defect_types ?? [],
    notes: row.notes,
    inspectedAt: row.inspected_at,
    createdAt: row.created_at,
  };
}
