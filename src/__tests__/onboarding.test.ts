import { describe, it, expect, beforeAll, afterAll } from "vitest";
import process from "node:process";

const T = 120000;
const TENANT = `__obtest_${Date.now()}__`;

async function cleanup() {
  const { db } = await import("../lib/sql-client");
  await db.query(`delete from journal_entry_lines where entry_id in (select id from journal_entries where tenant_slug = $1)`, [TENANT]);
  await db.query(`delete from journal_entries where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from account_balances where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from fiscal_periods where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from journal_sequences where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from accounting_audit_log where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from chart_of_accounts where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from inventory_stock_balances where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from stock_movements where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from inventory_warehouses where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from tenant_branches where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from tenant_onboarding_state where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from tenants where slug = $1`, [TENANT]);
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  await cleanup();
  const { db } = await import("../lib/sql-client");
  await db.query(
    `insert into tenants (name, slug, settings, seats)
     values ($1, $2, '{}'::jsonb, 1)
     on conflict (slug) do nothing`,
    ["Onboarding Test Co", TENANT]
  );
}, T);

afterAll(cleanup, T);

const step = (state: any, id: string) => state.steps.find((s: any) => s.id === id);

describe("validator error classification (no DB needed)", () => {
  it("maps missing-table errors to the owning migration", async () => {
    const { classifyValidatorError } = await import("../lib/tenant/onboarding");
    const err = Object.assign(new Error('relation "tenant_branches" does not exist'), { code: "42P01" });
    const r = classifyValidatorError(err, "fallback");
    expect(r.complete).toBe(false);
    expect(r.schemaPending).toBe("20261102_tenant_branches.sql");
    expect(r.detail).toContain("tenant_branches");
    expect(r.detail).toContain("20261102_tenant_branches.sql");
  });

  it("maps missing-column errors and unknown tables without inventing migrations", async () => {
    const { classifyValidatorError } = await import("../lib/tenant/onboarding");
    const col = Object.assign(new Error('column "x" does not exist'), { code: "42703" });
    expect(classifyValidatorError(col, "f").schemaPending).toBe("x");

    const unknown = Object.assign(new Error('relation "mystery_tbl" does not exist'), { code: "42P01" });
    const r = classifyValidatorError(unknown, "f");
    expect(r.schemaPending).toBe("mystery_tbl");
    expect(r.detail).toContain("pending migrations");
  });

  it("surfaces non-schema errors instead of hiding them", async () => {
    const { classifyValidatorError } = await import("../lib/tenant/onboarding");
    const perm = Object.assign(new Error("permission denied for table x"), { code: "42501" });
    const r = classifyValidatorError(perm, "fallback msg");
    expect(r.checkError).toBe(true);
    expect(r.schemaPending).toBeUndefined();
    expect(r.detail).toContain("permission denied");
  });
});

describe.skipIf(!process.env.DATABASE_URL)("tenant onboarding", () => {
  it("starts with required steps pending and live detail", async () => {
    const { getOnboardingState } = await import("../lib/tenant/onboarding");
    const state = await getOnboardingState(TENANT);

    expect(state.progress.requiredTotal).toBeGreaterThan(0);
    expect(step(state, "profile").status).toBe("pending"); // name set but no currency
    expect(step(state, "branches").status).toBe("pending");
    expect(step(state, "fiscal-periods").status).toBe("pending");
    expect(step(state, "go-live").status).toBe("pending");
    expect(state.dismissed).toBe(false);
    expect(state.completedAt).toBeNull();
  }, T);

  it("completes profile via updateTenantProfile", async () => {
    const { updateTenantProfile, getOnboardingState } = await import("../lib/tenant/onboarding");
    await updateTenantProfile(TENANT, { baseCurrency: "NGN", timezone: "Africa/Lagos" });
    const state = await getOnboardingState(TENANT);
    expect(step(state, "profile").status).toBe("complete");
    expect(step(state, "currencies").status).toBe("complete"); // base currency set
  }, T);

  it("flips branches and warehouses when real rows exist", async () => {
    const { createBranch } = await import("../lib/finance/branches");
    const { createWarehouse } = await import("../lib/inventory/warehouses");
    const { getOnboardingState } = await import("../lib/tenant/onboarding");

    const branch = await createBranch(TENANT, { name: "HQ", code: "HQ" });
    await createWarehouse(TENANT, { name: "Main Store", code: "MAIN", branchId: branch.id });

    const state = await getOnboardingState(TENANT);
    expect(step(state, "branches").status).toBe("complete");
    expect(step(state, "warehouses").status).toBe("complete");
  }, T);

  it("seeds chart of accounts and fiscal year idempotently", async () => {
    const { seedChartOfAccounts, seedFiscalYear, getOnboardingState } = await import("../lib/tenant/onboarding");

    const coa1 = await seedChartOfAccounts(TENANT);
    const coa2 = await seedChartOfAccounts(TENANT);
    expect(coa1.inserted).toBeGreaterThan(0);
    expect(coa2.inserted).toBe(0); // idempotent

    const fy = new Date().getFullYear();
    const fy1 = await seedFiscalYear(TENANT, fy);
    const fy2 = await seedFiscalYear(TENANT, fy);
    expect(fy1.inserted).toBe(12);
    expect(fy2.inserted).toBe(0); // idempotent

    const state = await getOnboardingState(TENANT);
    expect(step(state, "chart-of-accounts").status).toBe("complete");
    expect(step(state, "fiscal-periods").status).toBe("complete");
  }, T);

  it("skips optional steps, blocks skipping required, completes on go-live", async () => {
    const { skipStep, markCompleted, getOnboardingState } = await import("../lib/tenant/onboarding");

    // Cannot skip a required step
    await expect(skipStep(TENANT, "branches")).rejects.toThrow(/required/i);

    // Skip the remaining optional steps
    for (const id of ["team", "finance-policies", "opening-data"] as const) {
      await skipStep(TENANT, id);
    }
    let state = await getOnboardingState(TENANT);
    expect(step(state, "team").status).toBe("skipped");
    expect(step(state, "opening-data").status).toBe("skipped");
    expect(step(state, "opening-data").skipped).toBe(true);

    // Unskip restores pending unless data exists
    await skipStep(TENANT, "opening-data", false);
    state = await getOnboardingState(TENANT);
    expect(step(state, "opening-data").status).toBe("pending");

    // All required steps now validate → go-live completes
    state = await markCompleted(TENANT);
    expect(state.completedAt).not.toBeNull();
    expect(step(state, "go-live").status).toBe("complete");
  }, T);

  it("markCompleted rejects while required steps are pending", async () => {
    const { markCompleted, resetOnboarding } = await import("../lib/tenant/onboarding");
    const { db } = await import("../lib/sql-client");

    // Remove a required dependency (fiscal periods) → go-live must fail
    await db.query(`delete from fiscal_periods where tenant_slug = $1`, [TENANT]);
    await expect(markCompleted(TENANT)).rejects.toThrow(/required steps pending/i);

    // Reset clears stored metadata but live state still reflects reality
    await resetOnboarding(TENANT);
    const { getOnboardingState } = await import("../lib/tenant/onboarding");
    const state = await getOnboardingState(TENANT);
    expect(state.completedAt).toBeNull();
    expect(step(state, "fiscal-periods").status).toBe("pending");
    expect(step(state, "branches").status).toBe("complete"); // real data persists
  }, T);
});
