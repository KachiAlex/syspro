import process from "node:process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const T = 120000;
const TENANT = `__whtest_${Date.now()}__`;
const USER = `test-user-1`;

async function cleanup() {
  const { db } = await import("../lib/sql-client");
  await db.query(`delete from journal_entry_lines where entry_id in (select id from journal_entries where tenant_slug = $1)`, [TENANT]);
  await db.query(`delete from journal_entries where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from account_balances where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from fiscal_periods where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from journal_sequences where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from accounting_audit_log where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from stock_movements where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from inventory_stock_balances where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from inventory_stock_transfers where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from inventory_warehouses where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from tenant_user_branches where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from tenant_branches where tenant_slug = $1`, [TENANT]);
}

beforeAll(cleanup, T);
afterAll(cleanup, T);

describe.skipIf(!process.env.DATABASE_URL)("warehouses + branch reporting + access", () => {
  it("moves stock between warehouses with per-warehouse balances", async () => {
    const { createBranch } = await import("../lib/finance/branches");
    const { createWarehouse, transferStock, stockByWarehouse } = await import("../lib/inventory/warehouses");
    const { recordStockMovement } = await import("../lib/inventory/stock-movements");
    const { db } = await import("../lib/sql-client");

    const b1 = await createBranch(TENANT, { name: "North", code: "N" });
    const b2 = await createBranch(TENANT, { name: "South", code: "S" });
    const w1 = await createWarehouse(TENANT, { name: "North Store", code: "N-ST", branchId: b1.id });
    const w2 = await createWarehouse(TENANT, { name: "South Store", code: "S-ST", branchId: b2.id });

    await recordStockMovement(TENANT, {
      productSku: "WIDGET",
      productName: "Widget",
      movementType: "purchase_receipt",
      quantity: 100,
      unitCost: 10,
      referenceType: "test",
      referenceId: "grn-1",
      warehouseId: w1.id,
    }, { skipJournalEntry: true });

    let balances = await stockByWarehouse(TENANT);
    expect(balances.find((b: { warehouseId: string }) => b.warehouseId === w1.id)?.quantity).toBe(100);
    expect(balances.find((b: { warehouseId: string }) => b.warehouseId === w2.id)).toBeUndefined();

    const { outMovementId } = await transferStock({
      tenantSlug: TENANT,
      productSku: "WIDGET",
      quantity: 30,
      unitCost: 10,
      fromWarehouseId: w1.id,
      toWarehouseId: w2.id,
    });
    expect(outMovementId).toBeTruthy();

    balances = await stockByWarehouse(TENANT);
    expect(balances.find((b: { warehouseId: string }) => b.warehouseId === w1.id)?.quantity).toBe(70);
    expect(balances.find((b: { warehouseId: string }) => b.warehouseId === w2.id)?.quantity).toBe(30);

    // Transfer movements are signed and warehouse-tagged
    const moves = (await db.query<any>(
      `select warehouse_id, quantity from stock_movements
       where tenant_slug = $1 and movement_type = 'transfer' order by quantity`, [TENANT]
    )).rows;
    expect(moves).toHaveLength(2);
    expect(Number(moves[0].quantity)).toBe(-30);
    expect(moves[0].warehouse_id).toBe(w1.id);
    expect(Number(moves[1].quantity)).toBe(30);
    expect(moves[1].warehouse_id).toBe(w2.id);

    // Insufficient stock at source is rejected
    await expect(
      transferStock({
        tenantSlug: TENANT, productSku: "WIDGET", quantity: 1000, unitCost: 10,
        fromWarehouseId: w1.id, toWarehouseId: w2.id,
      })
    ).rejects.toThrow(/Insufficient stock/);
  }, T);

  it("breaks down P&L per branch", async () => {
    const { postGLEntry, GL_ACCOUNTS } = await import("../lib/finance/gl");
    const { generateBranchPnL } = await import("../lib/finance/reports-db");
    const { db } = await import("../lib/sql-client");

    const branches = (await db.query<any>(
      `select id, code from tenant_branches where tenant_slug = $1`, [TENANT]
    )).rows;
    const north = branches.find((b: any) => b.code === "N")!;
    const south = branches.find((b: any) => b.code === "S")!;

    await postGLEntry({
      tenantSlug: TENANT, entryDate: "2026-11-05", description: "north sale", branchId: north.id,
      lines: [
        { accountCode: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE, debitAmount: 500 },
        { accountCode: GL_ACCOUNTS.SALES_REVENUE, creditAmount: 500 },
      ],
    });
    await postGLEntry({
      tenantSlug: TENANT, entryDate: "2026-11-05", description: "south sale+expense", branchId: south.id,
      lines: [
        { accountCode: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE, debitAmount: 300 },
        { accountCode: GL_ACCOUNTS.SALES_REVENUE, creditAmount: 200 },
        { accountCode: GL_ACCOUNTS.GENERAL_EXPENSE, debitAmount: 0, creditAmount: 0 },
        { accountCode: GL_ACCOUNTS.SALES_REVENUE, debitAmount: 0, creditAmount: 100 },
      ],
    });
    await postGLEntry({
      tenantSlug: TENANT, entryDate: "2026-11-05", description: "south expense",
      lines: [
        { accountCode: GL_ACCOUNTS.GENERAL_EXPENSE, debitAmount: 80, branchId: south.id },
        { accountCode: GL_ACCOUNTS.ACCOUNTS_PAYABLE, creditAmount: 80, branchId: south.id },
      ],
    });

    const pnl = await generateBranchPnL({ tenantSlug: TENANT });
    const n = pnl.find((p) => p.branchId === north.id);
    const s = pnl.find((p) => p.branchId === south.id);
    expect(n?.revenue).toBe(500);
    expect(n?.netIncome).toBe(500);
    expect(s?.revenue).toBe(300);
    expect(s?.expenses).toBe(80);
    expect(s?.netIncome).toBe(220);
  }, T);

  it("scopes users to assigned branches", async () => {
    const {
      assignUserBranches, getBranchScope, resolveEffectiveBranchIds, listUserBranchAssignments,
    } = await import("../lib/finance/branches");
    const { db } = await import("../lib/sql-client");

    const branches = (await db.query<any>(
      `select id, code from tenant_branches where tenant_slug = $1`, [TENANT]
    )).rows;
    const north = branches.find((b: any) => b.code === "N")!;

    // Unrestricted before assignment
    expect(await getBranchScope(TENANT, USER)).toBeNull();

    await assignUserBranches(TENANT, USER, [north.id]);
    expect(await getBranchScope(TENANT, USER)).toEqual([north.id]);

    // In-scope request resolves; out-of-scope throws
    expect(await resolveEffectiveBranchIds(TENANT, USER, "N")).toEqual([north.id]);
    await expect(resolveEffectiveBranchIds(TENANT, USER, "S")).rejects.toThrow(/outside your access scope/);
    // No request → scope applied automatically
    expect(await resolveEffectiveBranchIds(TENANT, USER, null)).toEqual([north.id]);
    // Unrestricted user resolves anything
    const other = await resolveEffectiveBranchIds(TENANT, "someone-else", "S");
    expect(other).toHaveLength(1);

    const assignments = await listUserBranchAssignments(TENANT);
    expect(assignments.find((a) => a.userId === USER)?.branchId).toBe(north.id);

    // Clearing restores unrestricted access
    await assignUserBranches(TENANT, USER, []);
    expect(await getBranchScope(TENANT, USER)).toBeNull();
  }, T);
});
