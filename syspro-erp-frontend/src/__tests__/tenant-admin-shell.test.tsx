import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

import TenantAdminPage from "@/app/tenant-admin/page";

test("TenantAdmin shell: overview renders and section buttons toggle active state", () => {
  render(<TenantAdminPage />);

  // basic shell content
  expect(screen.getByText(/Tenant Admin/i)).toBeInTheDocument();
  expect(screen.getByText(/Overview \(placeholder\)/i)).toBeInTheDocument();

  const itButton = screen.getByRole("button", { name: /IT Support/i });
  const billingButton = screen.getByRole("button", { name: /Billing/i });

  // switch to IT Support
  fireEvent.click(itButton);
  expect(itButton).toHaveClass("bg-[color:var(--foreground)]");
  expect(itButton).toHaveClass("text-[color:var(--background)]");

  // switch to Billing
  fireEvent.click(billingButton);
  expect(billingButton).toHaveClass("bg-[color:var(--foreground)]");
  expect(billingButton).toHaveClass("text-[color:var(--background)]");
});