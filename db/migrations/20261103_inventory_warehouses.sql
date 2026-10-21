-- 20261103_inventory_warehouses.sql
-- Warehouse master + per-warehouse stock. Stock was single-location
-- (inventory_products.location free text); this adds a real warehouse tree
-- linked to branches, a warehouse column on stock_movements, per-warehouse
-- quantity/value balances, and warehouse columns on stock transfers.

CREATE TABLE IF NOT EXISTS inventory_warehouses (
  id text PRIMARY KEY,
  tenant_slug text NOT NULL,
  code text,
  name text NOT NULL,
  parent_warehouse_id text REFERENCES inventory_warehouses(id) ON DELETE SET NULL,
  branch_id text REFERENCES tenant_branches(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'warehouse',        -- 'warehouse' | 'transit'
  is_group boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_slug, code)
);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouses_tenant ON inventory_warehouses (tenant_slug);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouses_branch ON inventory_warehouses (branch_id);

ALTER TABLE IF EXISTS stock_movements ADD COLUMN IF NOT EXISTS warehouse_id text;
ALTER TABLE IF EXISTS stock_movements ADD COLUMN IF NOT EXISTS branch_id text;
CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse ON stock_movements (tenant_slug, warehouse_id);

ALTER TABLE IF EXISTS inventory_stock_transfers
  ADD COLUMN IF NOT EXISTS from_warehouse_id text,
  ADD COLUMN IF NOT EXISTS to_warehouse_id text;

CREATE TABLE IF NOT EXISTS inventory_stock_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  product_sku text NOT NULL,
  warehouse_id text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  value numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_slug, product_sku, warehouse_id)
);
CREATE INDEX IF NOT EXISTS idx_stock_balances_tenant ON inventory_stock_balances (tenant_slug);

-- Backfill: one "Main Store" warehouse per tenant that already has stock data.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_products') THEN
    INSERT INTO inventory_warehouses (id, tenant_slug, code, name)
    SELECT 'wh-main-' || md5(tenant_slug), tenant_slug, 'MAIN', 'Main Store'
    FROM (SELECT DISTINCT tenant_slug FROM inventory_products) t
    ON CONFLICT (tenant_slug, code) DO NOTHING;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_movements') THEN
    INSERT INTO inventory_warehouses (id, tenant_slug, code, name)
    SELECT 'wh-main-' || md5(tenant_slug), tenant_slug, 'MAIN', 'Main Store'
    FROM (SELECT DISTINCT tenant_slug FROM stock_movements) t
    ON CONFLICT (tenant_slug, code) DO NOTHING;

    -- Assign existing movements to the default warehouse.
    UPDATE stock_movements sm
    SET warehouse_id = w.id
    FROM inventory_warehouses w
    WHERE sm.tenant_slug = w.tenant_slug
      AND w.code = 'MAIN'
      AND sm.warehouse_id IS NULL;

    -- Rebuild per-warehouse balances from movement history. Transfers are
    -- signed (negative at source, positive at destination); other movement
    -- types keep their existing sign convention.
    INSERT INTO inventory_stock_balances (tenant_slug, product_sku, warehouse_id, quantity, value)
    SELECT
      tenant_slug,
      product_sku,
      warehouse_id,
      SUM(CASE
        WHEN movement_type IN ('purchase_receipt', 'return', 'work_order_receipt', 'adjustment') THEN quantity
        WHEN movement_type IN ('sale', 'work_order_issue') THEN -quantity
        WHEN movement_type = 'transfer' THEN quantity
        ELSE 0
      END),
      SUM(unit_cost * CASE
        WHEN movement_type IN ('purchase_receipt', 'return', 'work_order_receipt', 'adjustment') THEN quantity
        WHEN movement_type IN ('sale', 'work_order_issue') THEN -quantity
        WHEN movement_type = 'transfer' THEN quantity
        ELSE 0
      END)
    FROM stock_movements
    WHERE warehouse_id IS NOT NULL
    GROUP BY tenant_slug, product_sku, warehouse_id
    ON CONFLICT (tenant_slug, product_sku, warehouse_id) DO NOTHING;
  END IF;
END $$;
