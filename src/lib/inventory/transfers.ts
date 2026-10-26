import { db } from "../sql-client";

/**
 * Complete a pending stock transfer: move the goods and mark the row
 * completed. Extracted from the API route so the approvals engine can
 * replay it when a gated transfer is approved.
 */
export async function completeStockTransfer(tenantSlug: string, transferId: string) {
  const transfer = (await db.query(
    `select * from inventory_stock_transfers where id = $1 and tenant_slug = $2`,
    [transferId, tenantSlug]
  )).rows[0];
  if (!transfer) throw new Error("Transfer not found");
  if (transfer.status !== "pending") throw new Error(`Transfer is already ${transfer.status}`);

  const updated = (await db.query(
    `update inventory_stock_transfers set status = 'completed', completed_at = now()
     where id = $1 and tenant_slug = $2 returning *`,
    [transferId, tenantSlug]
  )).rows[0];

  if (transfer.from_warehouse_id && transfer.to_warehouse_id) {
    // Warehouse-aware path: signed transfer movements + per-warehouse
    // balances. No GL effect — inventory value is unchanged.
    const product = (await db.query(
      `select sku, name, unit_cost from inventory_products where id = $1 and tenant_slug = $2`,
      [transfer.product_id, tenantSlug]
    )).rows[0];
    const { transferStock } = await import("./warehouses");
    await transferStock({
      tenantSlug,
      productSku: transfer.product_sku ?? product?.sku ?? String(transfer.product_id),
      productName: product?.name,
      quantity: Number(transfer.quantity),
      unitCost: Number(product?.unit_cost ?? 0),
      fromWarehouseId: transfer.from_warehouse_id,
      toWarehouseId: transfer.to_warehouse_id,
      referenceId: transfer.id,
      serialNos: Array.isArray(transfer.serial_nos) ? transfer.serial_nos : undefined,
      lotNo: transfer.lot_no ?? undefined,
    });
  } else {
    // Legacy free-text location path
    await db.query(
      `update inventory_products set location = $1 where id = $2 and tenant_slug = $3 and location = $4`,
      [transfer.to_location, transfer.product_id, tenantSlug, transfer.from_location]
    );
  }

  return updated;
}
