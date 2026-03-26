import { randomUUID } from "node:crypto";
import { db, sql as SQL, SqlClient } from "../sql-client";

export type POItemRecord = {
  id: string;
  purchase_order_id: string;
  sku?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  created_at: string;
  updated_at: string;
};

export type PurchaseOrderRecord = {
  id: string;
  tenant_slug: string;
  supplier_id: string | null;
  order_number: string;
  status: string;
  issued_date: string;
  due_date: string;
  currency: string;
  total_amount: number;
  balance_due: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type PurchaseOrder = {
  id: string;
  tenantSlug: string;
  supplierId?: string | null;
  orderNumber: string;
  status: string;
  issuedDate: string;
  dueDate: string;
  currency: string;
  totalAmount: number;
  balanceDue: number;
  items: POItemRecord[];
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

/* using imported SQL */

export async function ensurePurchaseOrderTables(sql = SQL) {
  await sql`
    create table if not exists purchase_orders (
      id text primary key,
      tenant_slug text not null,
      supplier_id text,
      order_number text not null,
      status text not null default 'draft',
      issued_date date not null,
      due_date date not null,
      currency text not null default '₦',
      total_amount numeric not null,
      balance_due numeric not null,
      metadata jsonb,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`
    create table if not exists purchase_order_items (
      id text primary key,
      purchase_order_id text not null references purchase_orders(id) on delete cascade,
      sku text,
      description text not null,
      quantity numeric not null,
      unit_price numeric not null,
      amount numeric not null,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`create index if not exists purchase_orders_tenant_idx on purchase_orders (tenant_slug)`;
  await sql`create index if not exists purchase_orders_supplier_idx on purchase_orders (supplier_id)`;
  await sql`create index if not exists poi_order_idx on purchase_order_items (purchase_order_id)`;
}

function normalizePO(row: PurchaseOrderRecord, items: POItemRecord[]): PurchaseOrder {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    supplierId: row.supplier_id,
    orderNumber: row.order_number,
    status: row.status,
    issuedDate: row.issued_date,
    dueDate: row.due_date,
    currency: row.currency,
    totalAmount: Number(row.total_amount ?? 0),
    balanceDue: Number(row.balance_due ?? 0),
    items,
    metadata: row.metadata ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPurchaseOrders(filters: { tenantSlug: string; supplierId?: string | null; status?: string; limit?: number; offset?: number; }) {
  const sql = SQL;
  await ensurePurchaseOrderTables(sql);
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);

    let rows: PurchaseOrderRecord[] = [];
  if (filters.supplierId && filters.status) {
    rows = (await sql`
      select * from purchase_orders where tenant_slug = ${filters.tenantSlug} and supplier_id = ${filters.supplierId} and status = ${filters.status} order by issued_date desc limit ${limit} offset ${offset}
    `) as PurchaseOrderRecord[];
  } else if (filters.supplierId) {
    rows = (await sql`
      select * from purchase_orders where tenant_slug = ${filters.tenantSlug} and supplier_id = ${filters.supplierId} order by issued_date desc limit ${limit} offset ${offset}
    `) as PurchaseOrderRecord[];
  } else if (filters.status) {
    rows = (await sql`
      select * from purchase_orders where tenant_slug = ${filters.tenantSlug} and status = ${filters.status} order by issued_date desc limit ${limit} offset ${offset}
    `) as PurchaseOrderRecord[];
  } else {
    rows = (await sql`
      select * from purchase_orders where tenant_slug = ${filters.tenantSlug} order by issued_date desc limit ${limit} offset ${offset}
    `) as PurchaseOrderRecord[];
  }

  if (!rows.length) return [];

  const itemRows = (await sql`
    select * from purchase_order_items where purchase_order_id = any(${rows.map((r) => r.id)})
  `) as POItemRecord[];

  const grouped: Record<string, POItemRecord[]> = {};
  itemRows.forEach((it) => {
    grouped[it.purchase_order_id] = grouped[it.purchase_order_id] || [];
    grouped[it.purchase_order_id].push(it);
  });

  return rows.map((r) => normalizePO(r, grouped[r.id] ?? []));
}

export async function getPurchaseOrder(id: string) {
  const sql = SQL;
  await ensurePurchaseOrderTables(sql);

  const rows = (await sql`
    select * from purchase_orders where id = ${id} limit 1
  `) as PurchaseOrderRecord[];
  if (!rows.length) return null;
  const items = (await sql`
    select * from purchase_order_items where purchase_order_id = ${id}
  `) as POItemRecord[];

  return normalizePO(rows[0], items);
}

export async function createPurchaseOrder(payload: {
  tenantSlug: string;
  supplierId?: string | null;
  orderNumber: string;
  issuedDate: string;
  dueDate: string;
  currency?: string;
  items: Array<{ description: string; quantity: number; unitPrice: number; sku?: string }>;
  metadata?: Record<string, unknown>;
}) {
  const sql = SQL;
  await ensurePurchaseOrderTables(sql);

  const id = randomUUID();
  const total = payload.items.reduce((s, it) => s + (it.quantity * it.unitPrice), 0);

  const [row] = (await sql`
    insert into purchase_orders (id, tenant_slug, supplier_id, order_number, status, issued_date, due_date, currency, total_amount, balance_due, metadata)
    values (
      ${id}, ${payload.tenantSlug}, ${payload.supplierId ?? null}, ${payload.orderNumber}, ${"open"}, ${payload.issuedDate}, ${payload.dueDate}, ${payload.currency ?? "₦"}, ${total}, ${total}, ${payload.metadata ?? null}
    ) returning *
  `) as PurchaseOrderRecord[];

  const itemRows = await Promise.all(payload.items.map(async (it) => {
        const rows = (await sql`
          insert into purchase_order_items (id, purchase_order_id, sku, description, quantity, unit_price, amount)
          values (${randomUUID()}, ${id}, ${it.sku ?? null}, ${it.description}, ${it.quantity}, ${it.unitPrice}, ${it.quantity * it.unitPrice}) returning *
        `) as POItemRecord[];
    return rows[0];
  })) as POItemRecord[];

  return normalizePO(row, itemRows);
}

export async function updatePurchaseOrder(id: string, updates: Partial<PurchaseOrder>) {
  const sql = SQL;
  await ensurePurchaseOrderTables(sql);

  const [row] = (await sql`
    update purchase_orders set
      status = coalesce(${updates.status ?? null}, status),
      due_date = coalesce(${updates.dueDate ?? null}, due_date),
      updated_at = now()
    where id = ${id}
    returning *
  `) as PurchaseOrderRecord[];

  if (!row) return null;

  if (updates.items && Array.isArray(updates.items)) {
    await sql`delete from purchase_order_items where purchase_order_id = ${id}`;
    await Promise.all((updates.items as POItemRecord[]).map(async (it) => {
      await sql`
        insert into purchase_order_items (id, purchase_order_id, sku, description, quantity, unit_price, amount) values (${(it as any).id ?? randomUUID()}, ${id}, ${(it as any).sku ?? null}, ${(it as any).description}, ${(it as any).quantity}, ${(it as any).unit_price ?? (it as any).unitPrice}, ${(it as any).amount ?? (it as any).quantity * ((it as any).unit_price ?? (it as any).unitPrice)})
      `;
    }));
  }

  const items = (await sql`
    select * from purchase_order_items where purchase_order_id = ${id}
  `) as POItemRecord[];

  return normalizePO(row, items);
}

export async function deletePurchaseOrder(id: string) {
  const sql = SQL;
  await ensurePurchaseOrderTables(sql);

  const res = await db.query<{ count: number }>(`delete from purchase_orders where id = $1`, [id]);
  return res.count > 0;
}
