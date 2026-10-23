import { describe, it, expect } from "vitest";
import { hasDocAccess } from "../lib/tenant-admin/permissions";

describe("hasDocAccess — doc-level permission keys", () => {
  it("falls back to module level when no doc keys exist for the docType", () => {
    expect(hasDocAccess(["finance.write"], "bill", "submit")).toBe(true);
    expect(hasDocAccess(["finance.read", "finance.write"], "bill", "delete")).toBe(true);
  });

  it("grants all actions on the 'all' key", () => {
    expect(hasDocAccess(["all"], "bill", "submit")).toBe(true);
    expect(hasDocAccess(["all"], "journal_entry", "approve")).toBe(true);
  });

  it("grants all actions via doc.* and doc.<type>.* wildcards", () => {
    expect(hasDocAccess(["doc.*"], "bill", "cancel")).toBe(true);
    expect(hasDocAccess(["doc.bill.*"], "bill", "submit")).toBe(true);
    expect(hasDocAccess(["doc.bill.*"], "payment_entry", "submit")).toBe(true); // unrestricted type
  });

  it("restricts to assigned actions once docType keys exist", () => {
    const clerk = ["finance.write", "doc.bill.read", "doc.bill.create"];
    expect(hasDocAccess(clerk, "bill", "read")).toBe(true);
    expect(hasDocAccess(clerk, "bill", "create")).toBe(true);
    expect(hasDocAccess(clerk, "bill", "submit")).toBe(false);
    expect(hasDocAccess(clerk, "bill", "cancel")).toBe(false);
    // other docTypes unaffected
    expect(hasDocAccess(clerk, "invoice", "submit")).toBe(true);
  });

  it("enforces per-action granularity — the clerk/manager split", () => {
    const clerk = ["finance.write", "doc.journal_entry.create"];
    const manager = ["finance.write", "doc.journal_entry.create", "doc.journal_entry.approve"];
    expect(hasDocAccess(clerk, "journal_entry", "approve")).toBe(false);
    expect(hasDocAccess(manager, "journal_entry", "approve")).toBe(true);
  });

  it("denies when user has doc keys for the type but not the action", () => {
    expect(hasDocAccess(["doc.pos_sale.refund"], "pos_sale", "create")).toBe(false);
    expect(hasDocAccess(["doc.pos_sale.refund"], "pos_sale", "refund")).toBe(true);
  });
});
