/* @vitest-environment happy-dom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import BillingSection from "@/app/tenant-admin/sections/billing";

test("BillingSection renders heading and no-invoices fallback", () => {
  render(<BillingSection tenantSlug={undefined} />);

  expect(screen.getByText(/Recent Invoices/i)).toBeInTheDocument();
  expect(screen.getByText(/No invoices/i)).toBeInTheDocument();
});