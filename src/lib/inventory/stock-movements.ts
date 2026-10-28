import { sql as SQL, db } from "../sql-client";
import { createJournalEntry } from "../finance/accounting";
import { GL_ACCOUNTS } from "../finance/gl";
import { ensureOnce } from "@/lib/ensure-once";

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
  branchId?: string;
  warehouseId?: string;
  lotNo?: string;
  serialNos?: string[];
  expiryDate?: string;
  notes?: string;
  createdAt: string;
}

export function ensureStockMovementTables(...args: Parameters<typeof ensureStockMovementTablesRun>) {
  return ensureOnce("inventory/stock-movements:ensureStockMovementTables", () => ensureStockMovementTablesRun(...args));
}

async function ensureStockMovementTablesRun(sql = SQL) {
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
      branch_id text,
      notes text,
      created_at timestamptz default now()
    )
  `;
  await sql`alter table if exists stock_movements add column if not exists branch_id text`;
  await sql`alter table if exists stock_movements add column if not exists warehouse_id text`;
  await sql`alter table if exists stock_movements add column if not exists lot_no text`;
  await sql`alter table if exists stock_movements add column if not exists serial_nos jsonb`;
  await sql`create index if not exists stock_movements_tenant_idx on stock_movements (tenant_slug)`;
  await sql`create index if not exists stock_movements_sku_idx on stock_movements (tenant_slug, product_sku)`;
}

export async function recordStockMovement(
  tenantSlug: string,
  movement: Omit<StockMovement, "id" | "createdAt" | "tenantSlug">,
  options?: { skipJournalEntry?: boolean }
): Promise<StockMovement> {
  const sql = SQL;
  await ensureStockMovementTables(sql);

  const id = `mv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  // Serial/batch validation runs before the movement is recorded so a bad
  // serial or insufficient lot stock rejects the whole movement cleanly.
  const { validateMovementTracking, commitMovementTracking } = await import("./lot-tracking");
  await validateMovementTracking(tenantSlug, movement, {
    lotNo: movement.lotNo,
    serialNos: movement.serialNos,
    expiryDate: movement.expiryDate,
  });

  const [row] = (await sql`
    insert into stock_movements (
      id, tenant_slug, product_sku, product_name, movement_type,
      quantity, unit_cost, reference_type, reference_id, branch_id, warehouse_id,
      lot_no, serial_nos, notes, created_at
    )
    values (
      ${id}, ${tenantSlug}, ${movement.productSku}, ${movement.productName},
      ${movement.movementType}, ${movement.quantity}, ${movement.unitCost},
      ${movement.referenceType}, ${movement.referenceId}, ${movement.branchId ?? null},
      ${movement.warehouseId ?? null}, ${movement.lotNo ?? null},
      ${movement.serialNos ? JSON.stringify(movement.serialNos) : null},
      ${movement.notes ?? null}, ${now}
    )
    returning *
  `) as any[];

  // Tracking state must stay in lockstep with the movement — a commit failure
  // is fatal so the caller can compensate rather than silently diverge.
  await commitMovementTracking(tenantSlug, id, movement, {
    lotNo: movement.lotNo,
    serialNos: movement.serialNos,
    expiryDate: movement.expiryDate,
  });

  const positiveTypes: StockMovementType[] = ["purchase_receipt", "return", "work_order_receipt"];
  // "transfer" is intentionally absent: moving stock between locations is
  // net-zero on quantity and is handled by the stock-transfers endpoint.
  const negativeTypes: StockMovementType[] = ["sale", "work_order_issue"];

  if (positiveTypes.includes(movement.movementType)) {
    await sql`
      update inventory_products
      set current_stock = current_stock + ${movement.quantity}
      where tenant_slug = ${tenantSlug} and sku = ${movement.productSku}
    `;
  } else if (negativeTypes.includes(movement.movementType)) {
    // Conditional decrement: refuse to take stock below zero unless the
    // product explicitly allows negative stock. rowCount 0 => oversell.
    const res = await db.query(
      `update inventory_products
         set current_stock = current_stock - $1
       where tenant_slug = $2 and sku = $3
         and (allow_negative_stock or current_stock >= $1)`,
      [movement.quantity, tenantSlug, movement.productSku]
    );
    if (!res.rowCount) {
      throw new Error(
        `Insufficient stock for ${movement.productSku}: cannot sell/issue ${movement.quantity} unit(s)`
      );
    }
  } else if (movement.movementType === "adjustment") {
    await sql`
      update inventory_products
      set current_stock = current_stock + ${movement.quantity}
      where tenant_slug = ${tenantSlug} and sku = ${movement.productSku}
    `;
  }

  // Per-warehouse balance. Transfers carry a signed quantity; other types
  // derive their sign from movement_type.
  if (movement.warehouseId) {
    const signedQty = positiveTypes.includes(movement.movementType)
      ? Math.abs(movement.quantity)
      : negativeTypes.includes(movement.movementType)
        ? -Math.abs(movement.quantity)
        : movement.quantity; // transfer / adjustment carry their own sign
    try {
      const { adjustStockBalance } = await import("./warehouses");
      await adjustStockBalance(
        tenantSlug,
        movement.productSku,
        movement.warehouseId,
        signedQty,
        movement.unitCost
      );
    } catch (err) {
      console.error("Failed to update warehouse stock balance:", err);
    }
  }

  // FIFO valuation (opt-in per tenant): receipts push a cost layer,
  // issues consume oldest-first and stamp cogs_amount on the movement.
  // The captured COGS feeds the journal below so postings price at real
  // layer cost, not the sale/stale unitCost on the movement.
  let fifoCogs: number | undefined;
  try {
    const { getValuationMethod, fifoLayerIn, fifoLayerOut } = await import("./valuation");
    if (await getValuationMethod(tenantSlug) === "fifo") {
      if (positiveTypes.includes(movement.movementType)) {
        await fifoLayerIn({
          tenantSlug, productSku: movement.productSku,
          warehouseId: movement.warehouseId, quantity: Math.abs(movement.quantity),
          unitCost: movement.unitCost, referenceId: movement.referenceId,
        });
      } else if (negativeTypes.includes(movement.movementType)) {
        fifoCogs = await fifoLayerOut({
          tenantSlug, productSku: movement.productSku,
          warehouseId: movement.warehouseId, quantity: Math.abs(movement.quantity),
          movementId: id,
        });
      }
    }
  } catch (err) {
    console.error("FIFO layer update failed:", err);
  }

  if (!options?.skipJournalEntry) {
    await postStockMovementJournal(tenantSlug, movement, fifoCogs);
  }

  // Low-stock alert — only after stock-reducing movements, and deduped daily
  // per product so repeat sales don't spam.
  if (negativeTypes.includes(movement.movementType) || movement.movementType === "adjustment") {
    try {
      const [prod] = (await sql`
        select sku, name, current_stock, min_stock
        from inventory_products
        where tenant_slug = ${tenantSlug} and sku = ${movement.productSku}
      `) as any[];
      if (prod && prod.min_stock != null && Number(prod.current_stock) <= Number(prod.min_stock)) {
        const { emitEvent } = await import("@/lib/notify");
        const day = new Date().toISOString().slice(0, 10);
        void emitEvent({
          tenantSlug,
          eventType: "stock.low",
          sourceModule: "inventory",
          sourceRecordId: prod.sku,
          dedupeKey: `stocklow:${prod.sku}:${day}`,
          payload: {
            sku: prod.sku,
            itemName: prod.name,
            currentStock: Number(prod.current_stock),
            reorderLevel: Number(prod.min_stock),
          },
        });
      }
    } catch (err) {
      console.error("Failed to emit stock.low:", err);
    }
  }

  return row;
}

async function postStockMovementJournal(
  tenantSlug: string,
  movement: Omit<StockMovement, "id" | "createdAt" | "tenantSlug">,
  fifoCogsAmount?: number
): Promise<void> {
  // Skip journal entries for movement types that are already handled by their
  // source modules to prevent duplicate journal entries:
  // - purchase_receipt: handled by goods-receipts API route
  // - work_order_issue: handled by postWipJournalEntry in work-orders
  // - work_order_receipt: handled by postWipJournalEntry in work-orders
  const sourceHandledTypes: StockMovementType[] = ["purchase_receipt", "work_order_issue", "work_order_receipt"];
  if (sourceHandledTypes.includes(movement.movementType)) return;

  // Stock-out postings price at FIFO layer cost when valuation ran;
  // otherwise fall back to the movement's declared unitCost.
  const totalValue = fifoCogsAmount !== undefined && fifoCogsAmount > 0
    ? fifoCogsAmount
    : movement.quantity * movement.unitCost;
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
          branchId: movement.branchId,
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
          branchId: movement.branchId,
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
          branchId: movement.branchId,
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
          branchId: movement.branchId,
          description,
          lines: [
            { accountCode: GL_ACCOUNTS.COGS, debitAmount: totalValue, creditAmount: 0, description: "COGS — inventory sold" },
            { accountCode: "1500", debitAmount: 0, creditAmount: totalValue, description: "Inventory issued to customer" },
          ],
        });
        break;

      case "return":
        // Stock comes back in: reverse the COGS posting (Dr inventory, Cr COGS).
        await createJournalEntry({
          tenantSlug,
          entryDate: today,
          referenceType: "manual",
          referenceId: movement.referenceId,
          branchId: movement.branchId,
          description,
          lines: [
            { accountCode: "1500", debitAmount: totalValue, creditAmount: 0, description: "Inventory returned to stock" },
            { accountCode: GL_ACCOUNTS.COGS, debitAmount: 0, creditAmount: totalValue, description: "COGS reversal" },
          ],
        });
        break;

      case "adjustment":
        await createJournalEntry({
          tenantSlug,
          entryDate: today,
          referenceType: "manual",
          referenceId: movement.referenceId,
          branchId: movement.branchId,
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
