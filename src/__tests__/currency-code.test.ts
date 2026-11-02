import { describe, it, expect } from "vitest";
import { toCurrencyCode } from "../lib/currencies";

describe("toCurrencyCode", () => {
  it("passes ISO codes through in upper case", () => {
    expect(toCurrencyCode("ngn")).toBe("NGN");
    expect(toCurrencyCode("USD")).toBe("USD");
  });

  it("maps legacy display symbols to their ISO code", () => {
    expect(toCurrencyCode("₦")).toBe("NGN");
    expect(toCurrencyCode("$")).toBe("USD");
    expect(toCurrencyCode("€")).toBe("EUR");
  });

  it("defaults blank values to NGN", () => {
    expect(toCurrencyCode(undefined)).toBe("NGN");
    expect(toCurrencyCode("  ")).toBe("NGN");
  });

  it("rejects unrecognised values instead of guessing", () => {
    expect(() => toCurrencyCode("zzzz")).toThrow(/Unrecognised currency/);
  });
});
