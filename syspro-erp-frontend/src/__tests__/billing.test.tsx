import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import BillingSection from "@/app/tenant-admin/sections/billing";

beforeEach(() => {
  jest.spyOn(global, "fetch").mockImplementation((input: RequestInfo) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.includes("/api/tenant/billing")) {
      return Promise.resolve({ ok: true, json: async () => ({ invoices: [], subscriptions: [] }) } as any);
    }
    return Promise.resolve({ ok: true, json: async () => ({}) } as any);
  });
});

afterEach(() => {
  (global.fetch as jest.Mock).mockRestore();
});

test("BillingSection renders heading and no-invoices fallback", async () => {
  render(<BillingSection tenantSlug={undefined} />);

  // wait for loading -> resolved state
  expect(await screen.findByText(/Recent Invoices/i)).toBeInTheDocument();
  expect(await screen.findByText(/No invoices/i)).toBeInTheDocument();
});