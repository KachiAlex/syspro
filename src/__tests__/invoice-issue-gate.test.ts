import { describe, it, expect } from "vitest";
import { getGatedAction } from "../lib/finance/gated-actions";

/**
 * invoice_issue: draft → issued posts AR to the ledger, so it is a block-mode
 * gate on the sales domain. It must be opt-in (not always-gated) so tenants
 * without a sales authority band keep issuing immediately.
 */
describe("invoice_issue gated action", () => {
  const def = getGatedAction("invoice_issue");

  it("is registered on the sales domain in block mode", () => {
    expect(def).toBeDefined();
    expect(def!.domain).toBe("sales");
    expect(def!.mode).toBe("block");
  });

  it("is opt-in via the sales authority matrix, not always-gated", () => {
    expect(def!.always).toBeFalsy();
  });

  it("uses invoice value as the matrix band amount", () => {
    expect(def!.amount({ total: 250000 })).toBe(250000);
    expect(def!.amount({})).toBe(0);
  });

  it("describes the invoice being issued", () => {
    const text = def!.describe({ invoiceNumber: "INV-1001", total: 5000 });
    expect(text).toContain("Issue invoice INV-1001");
    expect(text).toContain("5,000");
  });
});
