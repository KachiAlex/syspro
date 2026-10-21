import { describe, it, expect, beforeAll, afterAll } from "vitest";

const T = 120000;
const TENANT = `__brtest_${Date.now()}__`;

async function cleanup() {
  const { db } = await import("@/lib/sql-client");
  await db.query(`delete from journal_entry_lines where entry_id in (select id from journal_entries where tenant_slug = $1)`, [TENANT]);
  await db.query(`delete from journal_entries where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from account_balances where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from fiscal_periods where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from journal_sequences where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from accounting_audit_log where tenant_slug = $1`, [TENANT]);
  await db.query(`delete from tenant_branches where tenant_slug = $1`, [TENANT]);
}

beforeAll(cleanup, T);
afterAll(cleanup, T);

describe.skipIf(!process.env.DATABASE_URL)("branch dimensions", () => {
  it("resolves document/line branchId (id or code) to canonical ids", async () => {
    const { createBranch } = await import("@/lib/finance/branches");
    const { postGLEntry, GL_ACCOUNTS } = await import("@/lib/finance/gl");
    const { db } = await import("@/lib/sql-client");

    const hq = await createBranch(TENANT, { name: "Head Office", code: "HQ" });
    const lekki = await createBranch(TENANT, { name: "Lekki", code: "LEK", parentBranchId: hq.id });

    const entry = await postGLEntry({
      tenantSlug: TENANT,
      entryDate: "2026-11-02",
      description: "branch resolution",
      branchId: "HQ", // code should resolve to hq.id
      lines: [
        { accountCode: GL_ACCOUNTS.BANK, debitAmount: 100 },
        { accountCode: GL_ACCOUNTS.SALES_REVENUE, creditAmount: 100, branchId: lekki.id },
      ],
    });

    const lines = (await db.query<any>(
      `select * from journal_entry_lines where entry_id = $1 order by line_number`, [entry.id]
    )).rows;
    expect(lines[0].branch_id).toBe(hq.id);       // document branch via code
    expect(lines[1].branch_id).toBe(lekki.id);    // line branch wins
  }, T);

  it("rejects unknown branch references", async () => {
    const { postGLEntry, GL_ACCOUNTS } = await import("@/lib/finance/gl");
    await expect(
      postGLEntry({
        tenantSlug: TENANT,
        entryDate: "2026-11-02",
        description: "bad branch",
        branchId: "no-such-branch",
        lines: [
          { accountCode: GL_ACCOUNTS.BANK, debitAmount: 10 },
          { accountCode: GL_ACCOUNTS.SALES_REVENUE, creditAmount: 10 },
        ],
      })
    ).rejects.toThrow(/Unknown branch/);
  }, T);

  it("applies the sole-active-branch tenant default when no branch given", async () => {
    const { db } = await import("@/lib/sql-client");
    const { postGLEntry, GL_ACCOUNTS } = await import("@/lib/finance/gl");

    // Leave exactly one active branch for this tenant
    await db.query(`update tenant_branches set status = 'inactive' where tenant_slug = $1 and code = 'LEK'`, [TENANT]);
    const hq = (await db.query<any>(
      `select id from tenant_branches where tenant_slug = $1 and status = 'active'`, [TENANT]
    )).rows[0];

    const entry = await postGLEntry({
      tenantSlug: TENANT,
      entryDate: "2026-11-03",
      description: "default branch",
      lines: [
        { accountCode: GL_ACCOUNTS.BANK, debitAmount: 25 },
        { accountCode: GL_ACCOUNTS.SALES_REVENUE, creditAmount: 25 },
      ],
    });

    const lines = (await db.query<any>(
      `select branch_id from journal_entry_lines where entry_id = $1`, [entry.id]
    )).rows;
    expect(lines.every((l: any) => l.branch_id === hq.id)).toBe(true);

    await db.query(`update tenant_branches set status = 'active' where tenant_slug = $1 and code = 'LEK'`, [TENANT]);
  }, T);

  it("syncs org-tree branch/subsidiary nodes into tenant_branches", async () => {
    const { syncBranchesFromTree, listBranches } = await import("@/lib/finance/branches");

    const tree = {
      id: "root", type: "tenant", name: "Org", status: "Live", manager: "Admin",
      children: [
        {
          id: "sub-1", type: "subsidiary", name: "Subsidiary NG", status: "Live", manager: "M1",
          children: [
            { id: "br-1", type: "branch", name: "Abuja", status: "Live", manager: "M2", metadata: { code: "ABJ", country: "Nigeria" }, children: [] },
          ],
        },
        { id: "br-2", type: "branch", name: "Lagos", status: "Planning", manager: "M3", children: [] },
      ],
    };

    await syncBranchesFromTree(TENANT, tree as any);
    const branches = await listBranches(TENANT);

    const sub = branches.find((b) => b.id === "sub-1");
    const abuja = branches.find((b) => b.id === "br-1");
    const lagos = branches.find((b) => b.id === "br-2");

    expect(sub?.kind).toBe("subsidiary");
    expect(abuja?.parentBranchId).toBe("sub-1");
    expect(abuja?.code).toBe("ABJ");
    expect(lagos?.status).toBe("planning");

    // Removing a node from the tree deactivates rather than deletes it
    await syncBranchesFromTree(TENANT, { ...tree, children: tree.children.slice(0, 1) } as any);
    const after = await listBranches(TENANT);
    expect(after.find((b) => b.id === "br-2")?.status).toBe("inactive");
  }, T);
});
