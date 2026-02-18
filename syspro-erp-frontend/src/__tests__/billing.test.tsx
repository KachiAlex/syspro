import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { axe, toHaveNoViolations } from 'jest-axe';

import BillingSection from "@/app/tenant-admin/sections/billing";

expect.extend(toHaveNoViolations);

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

  // wait for the loading indicator to disappear and then assert the final UI
  await waitFor(() => expect(screen.queryByText(/Loading billing information…/i)).not.toBeInTheDocument());

  expect(screen.getByText(/Recent Invoices/i)).toBeInTheDocument();
  expect(screen.getByText(/No invoices/i)).toBeInTheDocument();

  const results = await axe(document.body);
  expect(results).toHaveNoViolations();
});