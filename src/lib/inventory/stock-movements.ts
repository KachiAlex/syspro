import { sql as SQL } from "../sql-client";
import { createJournalEntry } from "../finance/accounting";

export type StockMovementType =
  | "purchase_receipt"
  | "work_order_issue"
  | "work_order_receipt"
  | "sale"
  | "transfer"
  | "adjustment"
  | "return";

export interface StockMovement {
  id: string;
  tenantSlug: string;
  productSku: string;
  productName: string;
  movementType: StockMovementType;
  quantity: number;
  unitCost: number;
  referenceType: string;
  referenceId: string;
  notes?: string;
  createdAt: string;
}

export async function ensureStockMovementTables(sql = SQL) {
  await sql`
    create table if not exists stock_movements (
      id text primary key,
      tenant_slug text not null,
      product_sku text not null,
      product_name text,
      movement_type text not null,
      quantity integer not null,
      unit_cost numeric not null default 0,
      reference_type text,
      reference_id text,
      notes text,
      created_at timestamptz default now()
    )
  `;
  await sql`create index if not exists stock_movements_tenant_idx on stock_movements (tenant_slug)`;
  await sql`create index if not exists stock_movements_sku_idx on stock_movements (tenant_slug, product_sku)`;
}

export async function recordStockMovement(
  tenantSlug: string,
  movement: Omit<StockMovement, "id" | "createdAt" | "tenantSlug">
): Promise<StockMovement> {
  const sql = SQL;
  await ensureStockMovementTables(sql);

  const id = `mv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  const [row] = (await sql`
    insert into stock_movements (
      id, tenant_slug, product_sku, product_name, movement_type,
      quantity, unit_cost, reference_type, reference_id, notes, created_at
    )
    values (
      ${id}, ${tenantSlug}, ${movement.productSku}, ${movement.productName},
      ${movement.movementType}, ${movement.quantity}, ${movement.unitCost},
      ${movement.referenceType}, ${movement.referenceId}, ${movement.notes ?? null}, ${now}
    )
    returning *
  `) as any[];

  await postStockMovementJournal(tenantSlug, movement);

  return row;
}

async function postStockMovementJournal(
  tenantSlug: string,
  movement: Omit<StockMovement, "id" | "createdAt" | "tenantSlug">
): Promise<void> {
  const totalValue = movement.quantity * movement.unitCost;
  if (Math.abs(totalValue) < 0.01) return;

  const today = new Date().toISOString().split("T")[0];
  const description = `${movement.movementType} — ${movement.productName} (${movement.quantity} units)`;

  try {
    switch (movement.movementType) {
      case "purchase_receipt":
        await createJournalEntry({
          tenantSlug,
          entryDate: today,
          referenceType: "manual",
          referenceId: movement.referenceId,
          description,
          lines: [
            { accountCode: "1500", debitAmount: totalValue, creditAmount: 0, description: "Inventory receipt" },
            { accountCode: "2100", debitAmount: 0, creditAmount: totalValue, description: "Accounts Payable" },
          ],
        });
        break;

      case "work_order_issue":
        await createJournalEntry({
          tenantSlug,
          entryDate: today,
          referenceType: "manual",
          referenceId: movement.referenceId,
          description,
          lines: [
            { accountCode: "1300", debitAmount: totalValue, creditAmount: 0, description: "WIP — material issue" },
            { accountCode: "1500", debitAmount: 0, creditAmount: totalValue, description: "Raw materials consumed" },
          ],
        });
        break;

      case "work_order_receipt":
        await createJournalEntry({
          tenantSlug,
          entryDate: today,
          referenceType: "manual",
          referenceId: movement.referenceId,
          description,
          lines: [
            { accountCode: "1400", debitAmount: totalValue, creditAmount: 0, description: "Finished goods receipt" },
            { accountCode: "1300", debitAmount: 0, creditAmount: totalValue, description: "WIP — completion" },
          ],
        });
        break;

      case "sale":
        await createJournalEntry({
          tenantSlug,
          entryDate: today,
          referenceType: "manual",
          referenceId: movement.referenceId,
          description,
          lines: [
            { accountCode: "6100", debitAmount: totalValue, creditAmount: 0, description: "COGS — inventory sold" },
            { accountCode: "1500", debitAmount: 0, creditAmount: totalValue, description: "Inventory issued to customer" },
          ],
        });
        break;

      case "adjustment":
        await createJournalEntry({
          tenantSlug,
          entryDate: today,
          referenceType: "manual",
          referenceId: movement.referenceId,
          description,
          lines: [
            { accountCode: "1500", debitAmount: totalValue > 0 ? totalValue : 0, creditAmount: totalValue < 0 ? Math.abs(totalValue) : 0, description: "Inventory adjustment" },
            { accountCode: "6100", debitAmount: totalValue < 0 ? Math.abs(totalValue) : 0, creditAmount: totalValue > 0 ? totalValue : 0, description: "Adjustment offset" },
          ],
        });
        break;

      default:
        break;
    }
  } catch (error) {
    console.error("Failed to post stock movement journal entry:", error);
  }
}

export async function listStockMovements(
  tenantSlug: string,
  filters?: { productSku?: string; movementType?: string; limit?: number }
): Promise<StockMovement[]> {
  const sql = SQL;
  await ensureStockMovementTables(sql);

  const limit = filters?.limit ?? 100;

  if (filters?.productSku) {
    const rows = (await sql`
      select * from stock_movements
      where tenant_slug = ${tenantSlug} and product_sku = ${filters.productSku}
      order by created_at desc limit ${limit}
    `) as any[];
    return rows.map(normalizeStockMovement);
  }

  if (filters?.movementType) {
    const rows = (await sql`
      select * from stock_movements
      where tenant_slug = ${tenantSlug} and movement_type = ${filters.movementType}
      order by created_at desc limit ${limit}
    `) as any[];
    return rows.map(normalizeStockMovement);
  }

  const rows = (await sql`
    select * from stock_movements
    where tenant_slug = ${tenantSlug}
    order by created_at desc limit ${limit}
  `) as any[];

  return rows.map(normalizeStockMovement);
}

function normalizeStockMovement(row: any): StockMovement {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    productSku: row.product_sku,
    productName: row.product_name ?? "",
    movementType: row.movement_type,
    quantity: Number(row.quantity),
    unitCost: Number(row.unit_cost),
    referenceType: row.reference_type ?? "",
    referenceId: row.reference_id ?? "",
    notes: row.notes,
    createdAt: row.created_at?.toISOString?.() ?? String(row.created_at ?? ""),
  };
}
