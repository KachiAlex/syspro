import { describe, it, expect, beforeAll, afterAll } from "vitest";
import process from "node:process";

/**
 * Repeat invoice-issue submissions must not create duplicate approvals. Two
 * concurrent submissions for the same invoice return one pending approval.
 * DB-backed: skipped without DATABASE_URL.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const TENANT = `__inv_gate_${Date.now()}__`;
let db: any;
let gateOrRun: any;

beforeAll(async () => {
  if (!HAS_DB) return;
  db = (await import("../lib/sql-client")).db;
  ({ gateOrRun } = await import("../lib/finance/gated-actions"));
  const { ensureApprovalTables } = await import("../lib/finance/approvals");
  await ensureApprovalTables();
  await db.query(
    `insert into tenants (name, slug, settings, seats) values ($1, $2, $3::jsonb, 1)
     on conflict (slug) do nothing`,
    ["Invoice Gate Test", TENANT, JSON.stringify({
      approvals: { authorityMatrix: { sales: [{ upTo: null, approvers: ["user:approver-1"] }] } },
    })]
  );
});

afterAll(async () => {
  if (!HAS_DB) return;
  await db.query(`delete from approvals where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from tenants where slug = $1`, [TENANT]);
});

describe.skipIf(!HAS_DB)("invoice_issue duplicate submissions", () => {
  it("returns one pending approval for concurrent submissions of the same invoice", async () => {
    const invoiceId = `inv-${Date.now()}`;
    const payload = { invoiceId, invoiceNumber: "INV-TEST", total: 1000, updates: { status: "sent" } };
    const ctx = { requestedBy: "user-1" };

    const [a, b] = await Promise.all([
      gateOrRun(TENANT, "invoice_issue", payload, ctx),
      gateOrRun(TENANT, "invoice_issue", payload, ctx),
    ]);

    expect(a.status).toBe("pending");
    expect(b.status).toBe("pending");
    expect(a.approvalId).toBe(b.approvalId);

    const rows = await db.query(
      `select id from approvals where tenant_slug = $1 and metadata->>'dedupeKey' = $2`,
      [TENANT, `invoice_issue:invoice:${invoiceId}`]
    );
    expect(rows.rows.length).toBe(1);
  }, 60000);

  it("refuses a different change to an invoice that already has a pending request", async () => {
    const invoiceId = `inv-diff-${Date.now()}`;
    const ctx = { requestedBy: "user-1" };
    const first = await gateOrRun(TENANT, "invoice_issue", { invoiceId, invoiceNumber: "INV-D", total: 1000, updates: { status: "sent" } }, ctx);
    const second = await gateOrRun(TENANT, "invoice_issue", { invoiceId, invoiceNumber: "INV-D", total: 1000, updates: { status: "sent", notes: "changed" } }, ctx);
    expect(first.status).toBe("pending");
    expect(second.status).toBe("denied");
  }, 60000);
});
