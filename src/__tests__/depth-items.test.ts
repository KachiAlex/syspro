import { describe, it, expect, beforeAll, afterAll } from "vitest";
import process from "node:process";

const T = 120000;
const TENANT = `test-depth-${Date.now()}`;
let db: any;
let projectId: string;
let productId: string;

async function cleanup() {
  await db.query(`delete from time_logs where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from task_assignments where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from tasks where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from workstreams where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from projects where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from admin_employees where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from pos_sales where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from pos_shifts where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from portal_tokens where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from custom_field_defs where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from import_jobs where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from storefront_orders where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from sales_orders where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from finance_payments where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from stock_movements where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from inventory_products where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from finance_customers where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from vendors where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from finance_invoice_lines where invoice_id in (select id from finance_invoices where tenant_slug = $1)`, [TENANT]);
  await db.query(`delete from finance_invoices where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from tax_transactions where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from journal_entry_lines where journal_entry_id in (select id from journal_entries where tenant_slug = $1)`, [TENANT]);
  await db.query(`delete from journal_entries where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from chart_of_accounts where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from tenants where slug = $1`, [TENANT]);
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  db = (await import("../lib/sql-client")).db;
  await cleanup();
  await db.query(
    `insert into tenants (name, slug, settings, seats)
     values ($1, $2, '{"currency":"NGN"}'::jsonb, 1)
     on conflict (slug) do nothing`,
    ["Depth Tests", TENANT]
  );
}, T);

afterAll(async () => {
  if (db) await cleanup();
}, T);

async function jeLinesFor(referenceId: string) {
  const rows = await db.query(
    `select l.* from journal_entry_lines l
     join journal_entries e on e.id = coalesce(l.journal_entry_id, l.entry_id)
     where e.tenant_slug = $1 and e.reference_id = $2`,
    [TENANT, referenceId]
  );
  return rows.rows ?? rows;
}

describe("timesheet → invoice billing", () => {
  it("generates an invoice for approved billable time and marks logs billed", async () => {
    const { generateTimesheetInvoice, billableTimeSummary, setProjectBilling } =
      await import("../lib/finance/timesheet-billing");

    // project → workstream → task → assignment → employee → time_logs
    const emp = (await db.query(
      `insert into admin_employees (id, tenant_slug, name, email) values (gen_random_uuid(), $1, 'Bill Timer', 'bill@t.co') returning id`, [TENANT]
    )).rows[0];
    const proj = (await db.query(
      `insert into projects (id, tenant_slug, code, name, status) values (gen_random_uuid(), $1, 'PRJ-T1', 'Billing Project', 'IN_PROGRESS') returning id`, [TENANT]
    )).rows[0];
    projectId = proj.id;
    const ws = (await db.query(
      `insert into workstreams (id, tenant_slug, code, name, project_id, status) values (gen_random_uuid(), $1, 'WS1', 'WS', $2, 'ACTIVE') returning id`, [TENANT, projectId]
    )).rows[0];
    const task = (await db.query(
      `insert into tasks (id, tenant_slug, code, title, project_id, workstream_id, status) values (gen_random_uuid(), $1, 'T1', 'Task', $2, $3, 'IN_PROGRESS') returning id`, [TENANT, projectId, ws.id]
    )).rows[0];
    const ta = (await db.query(
      `insert into task_assignments (id, tenant_slug, task_id, project_id, employee_id, status, assignment_start_date) values (gen_random_uuid(), $1, $2, $3, $4, 'ACCEPTED', '2026-11-01') returning id`, [TENANT, task.id, projectId, emp.id]
    )).rows[0];
    await db.query(
      `insert into time_logs (id, tenant_slug, task_assignment_id, task_id, project_id, employee_id, log_date, hours_logged, description, billable, approval_status)
       values (gen_random_uuid(), $1, $2, $3, $4, $5, '2026-11-10', 8, 'Dev work', true, 'APPROVED'),
              (gen_random_uuid(), $1, $2, $3, $4, $5, '2026-11-11', 4, 'More dev', true, 'APPROVED'),
              (gen_random_uuid(), $1, $2, $3, $4, $5, '2026-11-12', 3, 'Internal', false, 'APPROVED')`,
      [TENANT, ta.id, task.id, projectId, emp.id]
    );

    const summary = await billableTimeSummary(TENANT, { projectId });
    expect(summary[0].totalHours).toBe(12);
    expect(summary[0].entries).toBe(2);

    await setProjectBilling(TENANT, projectId, { customerName: "Billable Client", billingRate: 25000 });
    const result = await generateTimesheetInvoice(TENANT, { projectId });
    expect(result.hours).toBe(12);
    expect(result.amount).toBe(300000);

    // Invoice exists, logs stamped, second call rejects
    const inv = (await db.query(
      `select * from finance_invoices where id = $1 and tenant_slug = $2`, [result.invoiceId, TENANT]
    )).rows[0];
    expect(inv.customer_name).toBe("Billable Client");
    expect(Number(inv.amount)).toBe(300000);
    const stamped = (await db.query(
      `select count(*)::int as c from time_logs where tenant_slug = $1 and invoice_id = $2`, [TENANT, result.invoiceId]
    )).rows[0];
    expect(stamped.c).toBe(2);
    await expect(generateTimesheetInvoice(TENANT, { projectId })).rejects.toThrow(/uninvoiced/i);
  }, T);
});

describe("CSV import", () => {
  it("imports customers with row-level error reporting", async () => {
    const { importCsv } = await import("../lib/import/csv-import");
    const csv = [
      "name,code,email",
      "Acme Ltd,C-001,acme@co.ng",
      ",C-002,missing-name@co.ng",
      "Beta Corp,C-003,beta@co.ng",
    ].join("\n");
    const result = await importCsv(TENANT, "customers", csv);
    expect(result.imported).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.errors[0].row).toBe(3);
    const customers = await db.query(
      `select name from finance_customers where tenant_slug = $1 order by customer_code`, [TENANT]
    );
    expect(customers.rows.map((r: any) => r.name)).toEqual(["Acme Ltd", "Beta Corp"]);
  }, T);

  it("posts opening balances as a single balanced journal against equity", async () => {
    const { importCsv } = await import("../lib/import/csv-import");
    const csv = [
      "account_code,debit,credit,entry_date",
      "1100,500000,0,2026-11-01",
      "1200,150000,0,2026-11-01",
      "2100,0,200000,2026-11-01",
    ].join("\n");
    const result = await importCsv(TENANT, "opening_balances", csv);
    expect(result.imported).toBe(3);

    const entries = await db.query(
      `select id from journal_entries where tenant_slug = $1 and reference_type = 'opening_balance'`, [TENANT]
    );
    expect(entries.rows.length).toBe(1); // one entry, not one per row
    const lines = await db.query(
      `select account_code, debit_amount, credit_amount from journal_entry_lines
       where journal_entry_id = $1 or entry_id = $1 order by account_code`,
      [entries.rows[0].id]
    );
    expect(lines.rows.length).toBe(4); // 3 inputs + 3100 offset
    const offset = lines.rows.find((l: any) => l.account_code === "3100");
    expect(Number(offset.debit_amount)).toBe(200000);
    expect(Number(offset.credit_amount)).toBe(650000);
  }, T);

  it("dry-run validates without writing", async () => {
    const { importCsv } = await import("../lib/import/csv-import");
    const result = await importCsv(TENANT, "vendors", "name,code\nNoWrite Vendor,V-DRY", { dryRun: true });
    expect(result.imported).toBe(1);
    const vendors = await db.query(
      `select count(*)::int as c from vendors where tenant_slug = $1 and code = 'V-DRY'`, [TENANT]
    );
    expect(vendors.rows[0].c).toBe(0);
  }, T);
});

describe("POS", () => {
  it("requires an open shift and reconciles on close", async () => {
    const { createPosSale } = await import("../lib/pos/sales");
    const { openShift, getOpenShift, closeShift, getShiftSummary } = await import("../lib/pos/shifts");

    // Sale refused with no open shift
    await expect(createPosSale(TENANT, {
      items: [{ sku: "ANY", quantity: 1 }],
      paymentMethod: "cash",
    })).rejects.toThrow(/open shift/i);

    const shift = await openShift(TENANT, { openingFloat: 5000, openedBy: "test" });
    // Second open rejected
    await expect(openShift(TENANT, {})).rejects.toThrow(/already open/i);

    const prod = (await db.query(
      `insert into inventory_products (id, tenant_slug, name, sku, category, current_stock, unit_cost, sale_price, created_at)
       values (gen_random_uuid()::text, $1, 'Shift Widget', 'SHF-W1', 'pos', 10, 50, 200, now()) returning id`, [TENANT]
    )).rows[0];
    const sale = await createPosSale(TENANT, {
      items: [{ sku: "SHF-W1", quantity: 1 }],
      paymentMethod: "cash",
    });
    expect(sale.total).toBe(200);

    // Sale is stamped with the shift
    const ps = (await db.query(
      `select shift_id from pos_sales where id = $1`, [sale.id]
    )).rows[0];
    expect(ps.shift_id).toBe(shift.id);

    // Close: expected = 5000 float + 200 cash → counted 5250 → variance +50
    const closed = await closeShift(TENANT, shift.id, { closingCounted: 5250, closedBy: "test" });
    expect("error" in closed).toBe(false);
    expect(Number((closed as any).expectedCash ?? (closed as any).expected_cash)).toBe(5200);
    expect(Number((closed as any).variance)).toBe(50);
    expect(await getOpenShift(TENANT)).toBeNull();

    const summary = await getShiftSummary(TENANT, shift.id);
    expect(summary?.sales).toBe(1);
    expect(summary?.byMethod[0].method).toBe("cash");
  }, T);

  it("rings up a sale: paid invoice, receipt JE, stock decrement", async () => {
    const { createPosSale, posDailySummary } = await import("../lib/pos/sales");
    const { openShift } = await import("../lib/pos/shifts");
    await openShift(TENANT, { openedBy: "test" });
    const prod = (await db.query(
      `insert into inventory_products (id, tenant_slug, name, sku, category, current_stock, unit_cost, sale_price, created_at)
       values (gen_random_uuid()::text, $1, 'POS Widget', 'POS-W1', 'pos', 20, 100, 300, now()) returning id`, [TENANT]
    )).rows[0];
    productId = prod.id;

    // VAT is resolved server-side from tenant settings — clients can't set it.
    await db.query(
      `update tenants set settings = coalesce(settings,'{}'::jsonb) || '{"pos":{"vatRate":7.5}}'::jsonb where slug = $1`,
      [TENANT]
    );

    const sale = await createPosSale(TENANT, {
      items: [{ sku: "POS-W1", quantity: 2 }],
      paymentMethod: "cash",
      vatRate: 7.5,
    } as any);
    expect(sale.total).toBe(645); // 600 + 45 VAT

    const inv = (await db.query(
      `select * from finance_invoices where id = $1 and tenant_slug = $2`, [sale.invoiceId, TENANT]
    )).rows[0];
    expect(inv.status).toBe("paid");
    expect(Number(inv.balance_due)).toBe(0);

    // Receipt JE: Dr cash 645 / Cr AR 645
    const lines = await jeLinesFor(sale.receiptNo);
    const cash = lines.find((l: any) => l.account_code === "1110");
    const ar = lines.find((l: any) => l.account_code === "1200");
    expect(Number(cash.debit_amount)).toBe(645);
    expect(Number(ar.credit_amount)).toBe(645);

    // Stock decremented
    const p = (await db.query(
      `select current_stock from inventory_products where tenant_slug = $1 and sku = 'POS-W1'`, [TENANT]
    )).rows[0];
    expect(Number(p.current_stock)).toBe(18);

    const summary = await posDailySummary(TENANT);
    expect(summary.sales).toBeGreaterThanOrEqual(1);
  }, T);

  it("rejects unknown SKUs", async () => {
    const { createPosSale } = await import("../lib/pos/sales");
    const { openShift, getOpenShift } = await import("../lib/pos/shifts");
    if (!(await getOpenShift(TENANT))) await openShift(TENANT, {});
    await expect(createPosSale(TENANT, {
      items: [{ sku: "NOPE-1", quantity: 1 }],
      paymentMethod: "cash",
    })).rejects.toThrow(/Unknown SKU/);
  }, T);
});

describe("customer portal", () => {
  it("serves a read-only invoice view by token and honors revocation", async () => {
    const { createPortalToken, portalView, revokePortalToken } = await import("../lib/finance/portal");
    const { insertFinanceInvoice } = await import("../lib/finance/db");
    await insertFinanceInvoice({
      tenantSlug: TENANT, customerName: "Portal Client", customerCode: "C-POR",
      invoiceNumber: `INV-PORT-${Date.now()}`,
      issuedDate: "2026-11-01", dueDate: "2026-11-30", currency: "NGN", status: "sent",
      lineItems: [{ description: "Service", quantity: 1, unitPrice: 50000, amount: 50000 }],
      amount: 50000, balanceDue: 50000,
    } as any);

    const tok = await createPortalToken(TENANT, {
      partyType: "customer", partyId: "C-POR", partyName: "Portal Client",
    });
    const view = await portalView(tok.token);
    expect("invoices" in view && view.invoices!.length).toBeGreaterThanOrEqual(1);
    expect((view as any).totals.outstanding).toBeGreaterThanOrEqual(50000);
    expect((view as any).tenantSlug).toBe(TENANT);

    await revokePortalToken(TENANT, tok.id);
    const dead = await portalView(tok.token);
    expect("error" in dead).toBe(true);
  }, T);
});

describe("low-code custom fields", () => {
  it("defines fields, validates values, and persists into metadata", async () => {
    const { defineCustomField, setCustomFieldValues, getCustomFieldValues } =
      await import("../lib/platform/custom-fields");
    const { insertFinanceInvoice } = await import("../lib/finance/db");

    await defineCustomField(TENANT, {
      doctype: "finance_invoices", fieldName: "po_reference", label: "PO Reference",
      fieldType: "text", required: false,
    });
    await defineCustomField(TENANT, {
      doctype: "finance_invoices", fieldName: "region_code", label: "Region",
      fieldType: "select", options: ["SW", "SE", "NC"],
    });

    const inv = await insertFinanceInvoice({
      tenantSlug: TENANT, customerName: "CF Client",
      invoiceNumber: `INV-CF-${Date.now()}`,
      issuedDate: "2026-11-01", dueDate: "2026-11-30", currency: "NGN", status: "draft",
      lineItems: [{ description: "X", quantity: 1, unitPrice: 10, amount: 10 }],
      amount: 10, balanceDue: 10,
    } as any);

    // invalid select value rejected
    const bad = await setCustomFieldValues(TENANT, "finance_invoices", inv.id, {
      region_code: "XX",
    });
    expect(bad.error).toMatch(/must be one of/);

    const ok = await setCustomFieldValues(TENANT, "finance_invoices", inv.id, {
      po_reference: "PO-9", region_code: "SW",
    });
    expect(ok.error).toBeUndefined();
    const values = await getCustomFieldValues(TENANT, "finance_invoices", inv.id);
    expect((values as any).po_reference).toBe("PO-9");
    expect((values as any).region_code).toBe("SW");
  }, T);
});

describe("storefront", () => {
  it("lists the catalog, takes an order, and confirms it into an invoice", async () => {
    const { getCatalog, placeOrder, confirmOrder, getOrderStatus } =
      await import("../lib/storefront/orders");
    await db.query(
      `insert into inventory_products (id, tenant_slug, name, sku, category, current_stock, unit_cost, sale_price, created_at)
       values (gen_random_uuid()::text, $1, 'Web Widget', 'WEB-W1', 'web', 5, 200, 1000, now())`, [TENANT]
    );

    const catalog = await getCatalog(TENANT);
    expect(catalog.some((p) => p.sku === "WEB-W1")).toBe(true);

    // overselling rejected
    await expect(placeOrder(TENANT, {
      customerName: "Web Buyer", customerEmail: "buyer@co.ng",
      items: [{ sku: "WEB-W1", quantity: 99 }],
    })).rejects.toThrow(/Insufficient stock/);

    const order = await placeOrder(TENANT, {
      customerName: "Web Buyer", customerEmail: "buyer@co.ng",
      items: [{ sku: "WEB-W1", quantity: 2 }],
    });
    expect(order.total).toBe(2000);

    const status = await getOrderStatus(TENANT, order.orderNumber, "buyer@co.ng");
    expect(status?.status).toBe("pending");

    const confirmed = await confirmOrder(TENANT, order.id, "test-user");
    expect(confirmed.salesOrderId).toBeTruthy();
    expect(confirmed.invoiceId).toBeTruthy();

    // stock issued
    const p = (await db.query(
      `select current_stock from inventory_products where tenant_slug = $1 and sku = 'WEB-W1'`, [TENANT]
    )).rows[0];
    expect(Number(p.current_stock)).toBe(3);

    const after = await getOrderStatus(TENANT, order.orderNumber);
    expect(after?.status).toBe("confirmed");
  }, T);
});
