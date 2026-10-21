import { describe, it, expect, beforeAll, afterAll } from "vitest";
import process from "node:process";

const T = 120000;
const TENANT = `test-notify-${Date.now()}`;
let db: any;
let adminId: number;
let fmAdminId: number;
let empId: string;

async function cleanup() {
  // Some tables are created lazily by ensure* helpers and may not exist yet.
  const del = (text: string, params: any[] = [TENANT]) =>
    db.query(text, params).catch(() => {});
  await del(`delete from notification_outbox where tenant_slug = $1`);
  await del(`delete from app_notifications where tenant_slug = $1`);
  await del(`delete from notification_rules where tenant_slug = $1`);
  await del(`delete from user_notification_preferences where tenant_slug = $1`);
  await del(`delete from stock_movements where tenant_slug = $1`);
  await del(`delete from inventory_products where tenant_slug = $1`);
  await del(`delete from domain_events where tenant_slug = $1`);
  await del(`delete from approvals where tenant_slug = $1`);
  await del(`delete from approval_rules where tenant_slug = $1`);
  await del(`delete from dunning_notices where tenant_slug = $1`);
  await del(`delete from finance_payments where tenant_slug = $1`);
  await del(`delete from payment_applications where tenant_slug = $1`);
  await del(`delete from pos_shifts where tenant_slug = $1`);
  await del(`delete from pos_audit_log where tenant_slug = $1`);
  await del(`delete from pos_registers where tenant_slug = $1`);
  await del(`delete from admin_leave where tenant_slug = $1`);
  await del(`delete from admin_leave_balances where tenant_slug = $1`);
  await del(`delete from hr_audit_log where tenant_slug = $1`);
  await del(`delete from admin_employees where tenant_slug = $1`);
  await del(`delete from finance_invoice_lines where invoice_id in (select id from finance_invoices where tenant_slug = $1)`);
  await del(`delete from finance_invoices where tenant_slug = $1`);
  await del(`delete from finance_customers where tenant_slug = $1`);
  await del(`delete from crm_customers where tenant_slug = $1`);
  await del(`delete from journal_entry_lines where journal_entry_id in (select id from journal_entries where tenant_slug = $1)`);
  await del(`delete from journal_entries where tenant_slug = $1`);
  await del(`delete from chart_of_accounts where tenant_slug = $1`);
  await del(`delete from tenant_admins where tenant_slug = $1`);
  await del(`delete from tenants where slug = $1`);
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  db = (await import("../lib/sql-client")).db;
  const { ensureNotifyTables } = await import("../lib/notify");
  await ensureNotifyTables();
  // Pre-warm the HR schema (~30 tables of DDL) inside the 120s beforeAll
  // budget — over the remote tunnel the first ensure otherwise exceeds the
  // per-test timeout.
  const { ensureHrTables } = await import("../lib/hr/db");
  const { sql } = await import("../lib/sql-client");
  await ensureHrTables(sql);
  await cleanup();
  await db.query(
    `insert into tenants (name, slug, settings, seats) values ($1, $2, '{"currency":"NGN"}'::jsonb, 1)
     on conflict (slug) do nothing`,
    ["Notify Tests", TENANT]
  );
  const admins = await db.query(
    `insert into tenant_admins (tenant_slug, email, name, role) values
       ($1, 'owner@notify.test', 'Owner', 'admin'),
       ($1, 'fm@notify.test', 'Finance Manager', 'finance_manager')
     returning id`,
    [TENANT]
  );
  adminId = admins.rows[0].id;
  fmAdminId = admins.rows[1].id;
  const emp = await db.query(
    `insert into admin_employees (id, tenant_slug, name, email)
     values (gen_random_uuid(), $1, 'Leave User', 'leave@notify.test')
     returning id`,
    [TENANT]
  );
  empId = emp.rows[0].id;
}, T);

afterAll(async () => {
  if (db) await cleanup();
}, T);

const q = async (text: string, params: any[] = [TENANT]) => (await db.query(text, params)).rows;

describe("emitEvent → domain_events + routing", () => {
  it("writes the event and fans out email outbox rows to resolved role recipients", async () => {
    const { emitEvent } = await import("../lib/notify");
    await emitEvent({
      tenantSlug: TENANT,
      eventType: "return.posted",
      sourceModule: "finance",
      sourceRecordId: "ret-test-1",
      payload: { direction: "sales", documentNo: "CN-1", totalAmount: 5000 },
    });
    const events = await q(`select * from domain_events where tenant_slug = $1 and event_type = 'return.posted'`);
    expect(events).toHaveLength(1);
    const outbox = await q(`select * from notification_outbox where tenant_slug = $1 and event_type = 'return.posted'`);
    // finance_manager resolves + admin fallback union → both admins notified (channels email + in_app)
    const emails = outbox.filter((r: any) => r.channel === "email").map((r: any) => r.recipient);
    expect(emails).toContain("fm@notify.test");
    // the role is filled, so no fallback to all admins — owner is not included
    expect(emails).not.toContain("owner@notify.test");
  });

  it("app_notifications land instantly for in_app channel and actor is excluded", async () => {
    const { emitEvent, listAppNotifications, countUnreadAppNotifications, markAppNotificationsRead } =
      await import("../lib/notify");
    await emitEvent({
      tenantSlug: TENANT,
      eventType: "pos.shift_flagged",
      sourceModule: "pos",
      sourceRecordId: "shift-1",
      actorEmail: "owner@notify.test", // actor should not self-notify
      payload: { registerCode: "REG-01", variance: -500, expectedCash: 10000, closingCounted: 9500 },
    });
    const notifs = await listAppNotifications(TENANT, [String(fmAdminId)]);
    const hit = notifs.filter((n: any) => n.event_type === "pos.shift_flagged");
    expect(hit.length).toBeGreaterThanOrEqual(1);
    const unread = await countUnreadAppNotifications(TENANT, [String(fmAdminId)]);
    expect(unread).toBeGreaterThanOrEqual(1);
    // owner was the actor → excluded from in-app + email
    const ownerNotifs = await listAppNotifications(TENANT, [String(adminId), "owner@notify.test"]);
    expect(ownerNotifs.filter((n: any) => n.event_type === "pos.shift_flagged")).toHaveLength(0);
    await markAppNotificationsRead(TENANT, [String(fmAdminId)]);
    expect(await countUnreadAppNotifications(TENANT, [String(fmAdminId)])).toBe(0);
  });

  it("dedupes by (tenant, dedupe_key, channel, recipient)", async () => {
    const { emitEvent } = await import("../lib/notify");
    const input = {
      tenantSlug: TENANT,
      eventType: "dunning.issued",
      sourceModule: "finance",
      dedupeKey: "dunning:fixed-1",
      payload: { invoiceNumber: "INV-9", level: 1, daysOverdue: 15, balanceDue: 1000 },
    };
    await emitEvent(input);
    await emitEvent(input);
    const rows = await q(
      `select * from notification_outbox where tenant_slug = $1 and dedupe_key = 'dunning:fixed-1'`
    );
    // One row per recipient — a second emit adds zero
    const first = rows.length;
    await emitEvent(input);
    const rows2 = await q(
      `select * from notification_outbox where tenant_slug = $1 and dedupe_key = 'dunning:fixed-1'`
    );
    expect(rows2.length).toBe(first);
    expect(first).toBeGreaterThan(0);
  });

  it("tenant rule override replaces default routing and can disable an event", async () => {
    const { upsertNotificationRule, emitEvent } = await import("../lib/notify");
    await upsertNotificationRule({
      tenantSlug: TENANT,
      eventType: "payroll.run_posted",
      channels: ["email"],
      recipients: [{ kind: "emails", value: ["external@notify.test"] }],
      enabled: true,
    });
    await emitEvent({
      tenantSlug: TENANT,
      eventType: "payroll.run_posted",
      dedupeKey: "payroll:rule-test",
      payload: { period: "2026-11", totalNet: 100000 },
    });
    let rows = await q(
      `select * from notification_outbox where tenant_slug = $1 and dedupe_key = 'payroll:rule-test'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].recipient).toBe("external@notify.test");

    await upsertNotificationRule({
      tenantSlug: TENANT,
      eventType: "payroll.run_posted",
      channels: ["email"],
      recipients: [{ kind: "emails", value: ["external@notify.test"] }],
      enabled: false,
    });
    await emitEvent({
      tenantSlug: TENANT,
      eventType: "payroll.run_posted",
      dedupeKey: "payroll:disabled-test",
      payload: { period: "2026-11", totalNet: 100000 },
    });
    rows = await q(
      `select * from notification_outbox where tenant_slug = $1 and dedupe_key = 'payroll:disabled-test'`
    );
    expect(rows).toHaveLength(0);
  });
});

describe("drainNotificationOutbox", () => {
  it("sends pending email rows and records sent status", async () => {
    const { drainNotificationOutbox } = await import("../lib/notify");
    const result = await drainNotificationOutbox(100);
    const pending = await q(
      `select * from notification_outbox where tenant_slug = $1 and channel = 'email' and status = 'pending'`
    );
    expect(pending).toHaveLength(0);
    const sent = await q(
      `select * from notification_outbox where tenant_slug = $1 and channel = 'email' and status = 'sent'`
    );
    // result.sent counts every tenant drained — ours must be a subset
    expect(result.sent).toBeGreaterThanOrEqual(sent.length);
    expect(sent.length).toBeGreaterThan(0);
  });

  it("honors next_retry_at — future rows stay pending", async () => {
    const { ensureNotifyTables, drainNotificationOutbox } = await import("../lib/notify");
    await ensureNotifyTables();
    await db.query(
      `insert into notification_outbox (tenant_slug, dedupe_key, channel, event_type, recipient, subject, next_retry_at)
       values ($1, 'defer-1', 'email', 'test', 'later@notify.test', 'Later', now() + interval '1 hour')`,
      [TENANT]
    );
    await drainNotificationOutbox(100);
    const rows = await q(
      `select * from notification_outbox where tenant_slug = $1 and dedupe_key = 'defer-1'`
    );
    expect(rows[0].status).toBe("pending");
  });
});

describe("business-event emitters", () => {
  it("initiateApproval notifies step-0 approvers; decision notifies requester", async () => {
    const { initiateApproval, processApprovalDecision } = await import("../lib/finance/approvals");
    const approval = await initiateApproval({
      tenantSlug: TENANT,
      entityType: "journal_entry",
      entityId: "je-notify-1",
      requestedBy: `admin:${adminId}`,
      entityData: { amount: 500, reference: "JE-TEST" },
    });
    // ₦500 → step-0 only = role:dept_manager → unresolved role falls back to admins
    const reqRowsOk = await waitFor(async () =>
      (await q(`select * from notification_outbox where tenant_slug = $1 and event_type = 'approval.requested'`)).length > 0
    );
    expect(reqRowsOk).toBe(true);

    await processApprovalDecision({
      approvalId: approval.id,
      userId: `admin:${fmAdminId}`,
      userRole: "admin",
      decision: "approved",
    });
    const decidedOk = await waitFor(async () =>
      (await q(`select * from notification_outbox where tenant_slug = $1 and event_type = 'approval.decided'`)).length > 0
    );
    expect(decidedOk).toBe(true);
  });

  it("receiveInvoicePayment emits payment.received and emails the customer party", async () => {
    const { insertFinanceInvoice, receiveInvoicePayment } = await import("../lib/finance/db");
    const inv = await insertFinanceInvoice({
      tenantSlug: TENANT,
      customerName: "Notify Customer",
      customerCode: "NC-1",
      customerEmail: "customer@notify.test",
      invoiceNumber: `INV-N-${Date.now()}`,
      issuedDate: "2026-11-01",
      dueDate: "2026-12-01",
      amount: 5000,
      lineItems: [{ description: "Service", quantity: 1, unitPrice: 5000 }],
    });
    await receiveInvoicePayment({
      tenantSlug: TENANT,
      invoiceId: inv.id,
      amount: 5000,
      method: "bank_transfer",
      reference: "RCT-N-1",
      paymentDate: "2026-11-10",
    });
    const found = await waitFor(async () =>
      (await q(`select * from domain_events where tenant_slug = $1 and event_type = 'payment.received'`)).length === 1
    );
    expect(found).toBe(true);
    const emailsOk = await waitFor(async () =>
      (await q(`select recipient from notification_outbox where tenant_slug = $1 and event_type = 'payment.received' and channel = 'email'`))
        .map((r: any) => r.recipient).includes("customer@notify.test")
    );
    expect(emailsOk).toBe(true);
  });

  it("party spec resolves email from finance_customers via customerCode fallback", async () => {
    const { upsertCustomer } = await import("../lib/finance/credit-control");
    const { emitEvent } = await import("../lib/notify");
    await upsertCustomer({
      tenantSlug: TENANT, customerCode: "FALL-1", name: "Fallback Cust", email: "fallback@notify.test",
    });
    await emitEvent({
      tenantSlug: TENANT,
      eventType: "invoice.issued",
      dedupeKey: "party-fallback-1",
      payload: { invoiceNumber: "INV-F-1", amount: 100, customerCode: "FALL-1", customerName: "Fallback Cust" },
    });
    const rows = await q(
      `select recipient from notification_outbox where tenant_slug = $1 and dedupe_key = 'party-fallback-1' and channel = 'email'`
    );
    expect(rows.map((r: any) => r.recipient)).toContain("fallback@notify.test");
  });

  it("issueDunningNotice emits dunning.issued with deterministic dedupe", async () => {
    const { issueDunningNotice } = await import("../lib/finance/credit-control");
    const { insertFinanceInvoice } = await import("../lib/finance/db");
    const inv = await insertFinanceInvoice({
      tenantSlug: TENANT,
      customerName: "Late Payer",
      customerCode: "LP-1",
      customerEmail: "late@notify.test",
      invoiceNumber: `INV-D-${Date.now()}`,
      issuedDate: "2026-09-01",
      dueDate: "2026-09-10",
      amount: 2000,
      lineItems: [{ description: "Overdue", quantity: 1, unitPrice: 2000 }],
    });
    const notice = await issueDunningNotice({
      tenantSlug: TENANT,
      invoiceId: inv.id,
      issueDate: "2026-10-01",
    });
    const found = await waitFor(async () =>
      (await q(`select * from domain_events where tenant_slug = $1 and event_type = 'dunning.issued' and source_record_id = $2`,
        [TENANT, notice.id])).length === 1
    );
    expect(found).toBe(true);
    // customer party reached via the invoice's stored email
    const emailsOk = await waitFor(async () =>
      (await q(`select recipient from notification_outbox where tenant_slug = $1 and event_type = 'dunning.issued' and channel = 'email'`))
        .map((r: any) => r.recipient).includes("late@notify.test")
    );
    expect(emailsOk).toBe(true);
  });

  it("flagged shift close emits pos.shift_flagged", async () => {
    const { createRegister } = await import("../lib/pos/registers");
    const { openShift, closeShift } = await import("../lib/pos/shifts");
    const reg = await createRegister(TENANT, { code: "REG-NOTIFY", name: "Notify Register" });
    const opened = await openShift(TENANT, {
      registerId: reg.id,
      openingFloat: 10000,
      openedBy: `admin:${adminId}`,
    });
    const closed = await closeShift(TENANT, opened.id, {
      closingCounted: 5000,
      closedBy: `admin:${adminId}`,
      varianceReason: "till shortage",
    });
    expect("error" in closed).toBe(false);
    const rows = await q(
      `select * from domain_events where tenant_slug = $1 and event_type = 'pos.shift_flagged'`
    );
    expect(rows).toHaveLength(1);
  });

  it("leave decision emits leave.decided to the employee", async () => {
    const { updateLeaveStatus } = await import("../lib/hr/db");
    await db.query(
      `insert into admin_leave (id, tenant_slug, employee_id, employee_name, leave_type, start_date, end_date, reason, status)
       values (gen_random_uuid()::text, $1, $2, 'Leave User', 'annual', '2026-12-01', '2026-12-03', 'test', 'pending')
       returning id`,
      [TENANT, String(empId)]
    );
    const [leave] = await q(`select id from admin_leave where tenant_slug = $1 limit 1`);
    await updateLeaveStatus(leave.id, TENANT, "approved", `admin:${adminId}`);
    const found = await waitFor(async () =>
      (await q(`select * from domain_events where tenant_slug = $1 and event_type = 'leave.decided'`)).length === 1
    );
    expect(found).toBe(true);
    const emailOk = await waitFor(async () =>
      (await q(`select recipient from notification_outbox where tenant_slug = $1 and event_type = 'leave.decided' and channel = 'email'`))
        .map((r: any) => r.recipient).includes("leave@notify.test")
    );
    expect(emailOk).toBe(true);
  });
});

const waitFor = async (fn: () => Promise<boolean>, ms = 8000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
};

describe("user preferences", () => {
  it("daily frequency holds email rows until the digest pass, which sends them once", async () => {
    const { emitEvent, drainNotificationOutbox } = await import("../lib/notify");
    await db.query(
      `insert into user_notification_preferences (user_id, tenant_slug, preferences)
       values ('fm@notify.test', $1, '{"frequency":"daily"}'::jsonb)
       on conflict (user_id) do update set preferences = excluded.preferences`,
      [TENANT]
    );
    await emitEvent({
      tenantSlug: TENANT, eventType: "budget.breached",
      dedupeKey: `digest-${Date.now()}`,
      payload: { budgetCode: "B1", accountCode: "6000" },
    });
    const held = await waitFor(async () =>
      (await q(`select * from notification_outbox where tenant_slug = $1 and event_type = 'budget.breached' and status = 'held'`)).length === 1
    );
    expect(held).toBe(true);
    const [row] = await q(`select * from notification_outbox where tenant_slug = $1 and status = 'held'`);
    expect(new Date(row.next_retry_at).getTime()).toBeGreaterThan(Date.now());

    // Digest fires when the held row comes due
    await db.query(`update notification_outbox set next_retry_at = now() where tenant_slug = $1 and status = 'held'`, [TENANT]);
    const res = await drainNotificationOutbox();
    expect(res.sent).toBeGreaterThanOrEqual(1);
    const remaining = await q(`select * from notification_outbox where tenant_slug = $1 and status = 'held'`);
    expect(remaining).toHaveLength(0);

    await db.query(`delete from user_notification_preferences where tenant_slug = $1`, [TENANT]);
  });

  it("quiet hours defer email sends without suppressing in-app rows", async () => {
    const { emitEvent } = await import("../lib/notify");
    await db.query(
      `insert into user_notification_preferences (user_id, tenant_slug, preferences)
       values ('quiet@notify.test', $1, '{"quietHours":{"enabled":true,"start":"00:00","end":"23:59","timezone":"UTC"}}'::jsonb)
       on conflict (user_id) do update set preferences = excluded.preferences`,
      [TENANT]
    );
    await emitEvent({
      tenantSlug: TENANT, eventType: "invoice.issued",
      dedupeKey: `quiet-${Date.now()}`,
      explicitSpecs: [{ kind: "emails", value: ["quiet@notify.test"] }],
      payload: { invoiceNumber: "QUIET-1" },
    });
    const ok = await waitFor(async () =>
      (await q(`select * from notification_outbox where tenant_slug = $1 and recipient = 'quiet@notify.test' and channel = 'email'`)).length === 1
    );
    expect(ok).toBe(true);
    const [row] = await q(`select * from notification_outbox where tenant_slug = $1 and recipient = 'quiet@notify.test'`);
    expect(row.status).toBe("pending");
    expect(new Date(row.next_retry_at).getTime()).toBeGreaterThan(Date.now() + 30 * 60_000);
  });

  it("email_enabled=false skips email but in-app still lands", async () => {
    const { emitEvent } = await import("../lib/notify");
    const key = String(adminId);
    await db.query(
      `insert into user_notification_preferences (user_id, tenant_slug, preferences)
       values ($2, $1, '{"email":false,"inApp":true}'::jsonb)
       on conflict (user_id) do update set preferences = excluded.preferences`,
      [TENANT, key]
    );
    await emitEvent({
      tenantSlug: TENANT, eventType: "invoice.issued",
      dedupeKey: `noemail-${Date.now()}`,
      explicitRecipients: [{ id: key, email: "owner@notify.test" }],
      payload: { invoiceNumber: "NOEMAIL-1" },
    });
    const ok = await waitFor(async () =>
      (await q(`select * from app_notifications where tenant_slug = $1 and user_id = $2`, [TENANT, key])).length >= 1
    );
    expect(ok).toBe(true);
    const emails = await q(
      `select * from notification_outbox where tenant_slug = $1 and recipient = 'owner@notify.test' and channel = 'email' and event_type = 'invoice.issued'`
    );
    expect(emails).toHaveLength(0);
    await db.query(`delete from user_notification_preferences where user_id = $1`, [key]);
  });
});

describe("second-wave emitters", () => {
  it("upsertCustomer emits customer.credit_hold only on the transition", async () => {
    const { upsertCustomer } = await import("../lib/finance/credit-control");
    await upsertCustomer({ tenantSlug: TENANT, customerCode: "HOLD-1", name: "Hold Co", creditHold: false });
    await upsertCustomer({ tenantSlug: TENANT, customerCode: "HOLD-1", name: "Hold Co", creditHold: true });
    const fired = await waitFor(async () =>
      (await q(`select * from domain_events where tenant_slug = $1 and event_type = 'customer.credit_hold'`)).length === 1
    );
    expect(fired).toBe(true);
    // Re-saving with hold already on must NOT re-emit
    await upsertCustomer({ tenantSlug: TENANT, customerCode: "HOLD-1", name: "Hold Co", creditHold: true });
    await new Promise((r) => setTimeout(r, 500));
    const rows = await q(`select * from domain_events where tenant_slug = $1 and event_type = 'customer.credit_hold'`);
    expect(rows).toHaveLength(1);
  });

  it("recordStockMovement emits stock.low once per product per day", async () => {
    const { recordStockMovement, ensureStockMovementTables } = await import("../lib/inventory/stock-movements");
    const { sql } = await import("../lib/sql-client");
    await ensureStockMovementTables(sql);
    await db.query(
      `insert into inventory_products (id, tenant_slug, name, sku, category, current_stock, min_stock, unit_cost, sale_price, created_at)
       values (gen_random_uuid()::text, $1, 'Low Widget', 'LOWSKU-1', 'stock', 10, 5, 10, 20, now())`,
      [TENANT]
    );
    const mv = (qty: number, ref: string) => recordStockMovement(TENANT, {
      productSku: "LOWSKU-1", productName: "Low Widget", movementType: "sale",
      quantity: qty, unitCost: 10, referenceType: "test", referenceId: ref,
    }, { skipJournalEntry: true });
    await mv(6, "s1"); // 10 -> 4, below min 5 → emit
    const fired = await waitFor(async () =>
      (await q(`select * from notification_outbox where tenant_slug = $1 and event_type = 'stock.low'`)).length >= 1
    );
    expect(fired).toBe(true);
    // let the first event's fan-out finish before snapshotting the count
    await new Promise((r) => setTimeout(r, 2000));
    const before = await q(`select * from notification_outbox where tenant_slug = $1 and event_type = 'stock.low'`);
    await mv(1, "s2"); // 4 -> 3, still below — dedupe same day
    await new Promise((r) => setTimeout(r, 2000));
    const after = await q(`select * from notification_outbox where tenant_slug = $1 and event_type = 'stock.low'`);
    expect(after.length).toBe(before.length);
  });
});
