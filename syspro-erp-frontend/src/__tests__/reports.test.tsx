/* @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import "@testing-library/jest-dom";

import ReportsSection from "@/app/tenant-admin/sections/reports";

expect.extend(toHaveNoViolations);

test("ReportsSection renders header and is accessible", async () => {
  render(<ReportsSection tenantSlug={undefined} />);

  expect(screen.getByText(/Operational, financial, and executive/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Refresh/i })).toBeInTheDocument();

  const results = await axe(document.body);
  expect(results).toHaveNoViolations();
});