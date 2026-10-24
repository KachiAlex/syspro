export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authenticateExternal } from "@/lib/external/auth";
import { db, sql as SQL } from "@/lib/sql-client";
import { ensureCrmTables, insertCustomer } from "@/lib/crm/db";
import { getDefaultBranchId } from "@/lib/finance/branches";
import {
  computeQuantity,
  computeTotal,
  ensureSalesOrdersTable,
  findOrder,
  mapOrder,
} from "@/lib/sales/orders";

const OrderItemSchema = z.object({
  description: z.string().min(1).max(400).optional(),
  name: z.string().min(1).max(400).optional(),
  sku: z.string().max(120).optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
});

const OrderSchema = z
  .object({
    customerId: z.string().max(120).optional(),
    customerName: z.string().max(200).optional(),
    orderDate: z.string().max(30).optional(),
    items: z.array(OrderItemSchema).min(1),
    notes: z.string().max(4000).optional(),
    reference: z.string().max(120).optional(),
    // External system's own id — retried posts return the original order.
    externalId: z.string().max(120).optional(),
  })
  .refine((v) => v.customerId || v.customerName, {
    message: "Provide customerId or customerName",
  });

let externalIdEnsured = false;
async function ensureExternalIdColumn() {
  if (externalIdEnsured) return;
  await ensureSalesOrdersTable();
  await SQL`alter table sales_orders add column if not exists external_id text`;
  await SQL`create unique index if not exists sales_orders_external_uidx
            on sales_orders (tenant_slug, external_id) where external_id is not null`;
  externalIdEnsured = true;
}

/** Find an existing customer by name (case-insensitive) or create one. */
async function findOrCreateCustomer(tenantSlug: string, name: string) {
  const found = (
    await db.query<any>(
      `select id, name from crm_customers where tenant_slug = $1 and lower(name) = lower($2) limit 1`,
      [tenantSlug, name]
    )
  ).rows[0];
  if (found) return { id: found.id as string, name: found.name as string };
  const branchId = (await getDefaultBranchId(tenantSlug)) ?? "default";
  const created = await insertCustomer({
    tenantSlug,
    regionId: "default",
    branchId,
    name,
    status: "active",
  });
  return { id: created.id, name: created.name };
}

/**
 * Push a sale into this tenant as a sales order.
 * Headers: x-api-key (or Bearer) + x-tenant-slug.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateExternal(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = OrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;

  try {
    await ensureCrmTables(SQL);
    await ensureExternalIdColumn();

    const externalId = input.externalId ?? input.reference;
    if (externalId) {
      const existing = (
        await db.query<any>(
          `select id from sales_orders where tenant_slug = $1 and external_id = $2`,
          [auth.tenantSlug, externalId]
        )
      ).rows[0];
      if (existing) {
        const row = await findOrder(existing.id, auth.tenantSlug);
        return NextResponse.json({ order: mapOrder(row), duplicate: true });
      }
    }

    // Resolve the customer — by id when supplied, else find-or-create by name.
    let customer: { id: string; name: string };
    if (input.customerId) {
      const row = (
        await db.query<any>(
          `select id, name from crm_customers where id = $1 and tenant_slug = $2`,
          [input.customerId, auth.tenantSlug]
        )
      ).rows[0];
      if (!row) {
        return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      }
      customer = { id: row.id, name: row.name };
    } else {
      customer = await findOrCreateCustomer(auth.tenantSlug, input.customerName!);
    }

    const items = input.items.map((it) => ({
      description: it.description ?? it.name ?? "",
      name: it.name ?? it.description ?? "",
      sku: it.sku ?? "",
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      amount: it.quantity * it.unitPrice,
    }));
    const total = computeTotal(items);
    const quantity = computeQuantity(items);

    // Same credit control the internal order form applies.
    const { assertCreditAvailable } = await import("@/lib/finance/credit-control");
    const creditCheck = await assertCreditAvailable(auth.tenantSlug, customer.id, total).catch(
      (err) => ({ error: err instanceof Error ? err.message : String(err) })
    );
    if ((creditCheck as any).error) {
      return NextResponse.json({ error: (creditCheck as any).error }, { status: 402 });
    }

    const id = `so_${Date.now()}`;
    const orderNumber = `SO-${Date.now().toString().slice(-6)}`;
    const orderDate = input.orderDate || new Date().toISOString().slice(0, 10);
    const notes = input.reference
      ? [input.notes, `External ref: ${input.reference}`].filter(Boolean).join(" | ")
      : (input.notes ?? "");

    await db.query(
      `INSERT INTO sales_orders (id, tenant_slug, order_number, customer_id, customer_name, order_date, due_date, items, quantity, total, status, notes, deal_id, external_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        id, auth.tenantSlug, orderNumber, customer.id, customer.name, orderDate, "",
        JSON.stringify(items), quantity, total, "Pending", notes, null,
        externalId ?? null, new Date().toISOString(),
      ]
    );

    const row = await findOrder(id, auth.tenantSlug);
    return NextResponse.json(
      { order: mapOrder(row), customerId: customer.id, message: "Sales order created" },
      { status: 201 }
    );
  } catch (error) {
    console.error("External order create failed:", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
