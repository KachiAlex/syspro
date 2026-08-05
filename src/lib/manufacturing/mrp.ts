import { sql as SQL, SqlClient } from "../sql-client";
import { explodeBom } from "./bom";
import { ensureBomTables } from "./bom";
import { randomUUID } from "crypto";

export interface MrpDemandItem {
  productSku: string;
  productName: string;
  quantity: number;
  dueDate: string;
  source: string;
}

export interface MrpRequirement {
  componentSku: string;
  componentName: string;
  grossRequirement: number;
  onHand: number;
  netRequirement: number;
  unit: string;
  unitCost: number;
  shortage: boolean;
  source: string;
}

export interface MrpPlan {
  tenantSlug: string;
  generatedAt: string;
  demands: MrpDemandItem[];
  requirements: MrpRequirement[];
  totalShortages: number;
  totalShortageValue: number;
}

export async function runMrp(
  tenantSlug: string,
  demands: MrpDemandItem[]
): Promise<MrpPlan> {
  const sql = SQL;
  await ensureBomTables(sql);

  const requirementMap = new Map<string, MrpRequirement>();

  for (const demand of demands) {
    const explosion = await explodeBom(demand.productSku, tenantSlug, demand.quantity);

    for (const item of explosion) {
      if (item.componentType !== "raw_material") continue;

      const existing = requirementMap.get(item.componentSku);
      if (existing) {
        existing.grossRequirement += item.quantity;
        existing.netRequirement = Math.max(0, existing.grossRequirement - existing.onHand);
        existing.shortage = existing.netRequirement > 0;
      } else {
        const onHand = await getInventoryOnHand(item.componentSku, tenantSlug);
        const unitCost = await getComponentUnitCost(item.componentSku, tenantSlug);
        const netRequirement = Math.max(0, item.quantity - onHand);
        requirementMap.set(item.componentSku, {
          componentSku: item.componentSku,
          componentName: item.componentName,
          grossRequirement: item.quantity,
          onHand,
          netRequirement,
          unit: item.unit,
          unitCost,
          shortage: netRequirement > 0,
          source: demand.productSku,
        });
      }
    }
  }

  const requirements = Array.from(requirementMap.values());
  const totalShortages = requirements.filter((r) => r.shortage).length;
  const totalShortageValue = requirements
    .filter((r) => r.shortage)
    .reduce((sum, r) => sum + r.netRequirement * r.unitCost, 0);

  return {
    tenantSlug,
    generatedAt: new Date().toISOString(),
    demands,
    requirements,
    totalShortages,
    totalShortageValue,
  };
}

async function getInventoryOnHand(sku: string, tenantSlug: string): Promise<number> {
  const sql = SQL;
  try {
    const [row] = (await sql`
      select current_stock from inventory_products
      where tenant_slug = ${tenantSlug} and sku = ${sku}
      limit 1
    `) as any[];
    return row ? Number(row.current_stock) : 0;
  } catch {
    return 0;
  }
}

async function getComponentUnitCost(sku: string, tenantSlug: string): Promise<number> {
  const sql = SQL;
  try {
    const [row] = (await sql`
      select unit_cost from inventory_products
      where tenant_slug = ${tenantSlug} and sku = ${sku}
      limit 1
    `) as any[];
    return row ? Number(row.unit_cost) : 0;
  } catch {
    return 0;
  }
}

export async function generateRequisitionsFromMrp(
  tenantSlug: string,
  plan: MrpPlan,
  requestedBy?: string
): Promise<{ requisitionId: string; requisitionNumber: string; itemCount: number; totalAmount: number } | null> {
  const sql = SQL;
  const shortages = plan.requirements.filter((r) => r.shortage && r.netRequirement > 0);

  if (shortages.length === 0) return null;

  const id = randomUUID();
  const now = new Date();
  const reqNumber = `PR-MRP-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${id.slice(0, 6).toUpperCase()}`;

  const items = shortages.map((r) => ({
    componentSku: r.componentSku,
    componentName: r.componentName,
    quantity: r.netRequirement,
    unit: r.unit,
    unitCost: r.unitCost,
    notes: `Auto-generated from MRP run at ${plan.generatedAt}`,
  }));

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

  await sql`
    create table if not exists procurement_requisitions (
      id text primary key,
      tenant_slug text not null,
      requisition_number text not null,
      items jsonb not null,
      total_amount numeric not null default 0,
      status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'converted')),
      source text not null default 'manual',
      notes text,
      requested_by text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`
    insert into procurement_requisitions (
      id, tenant_slug, requisition_number, items, total_amount, status, source, notes, requested_by, created_at, updated_at
    )
    values (
      ${id}, ${tenantSlug}, ${reqNumber},
      ${JSON.stringify(items)}::jsonb,
      ${totalAmount}, 'pending', 'mrp',
      ${`Auto-generated from MRP run at ${plan.generatedAt}`},
      ${requestedBy ?? null}, ${now}, ${now}
    )
  `;

  return {
    requisitionId: id,
    requisitionNumber: reqNumber,
    itemCount: items.length,
    totalAmount,
  };
}
