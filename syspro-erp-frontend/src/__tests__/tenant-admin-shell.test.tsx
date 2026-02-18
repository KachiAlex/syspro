import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

import TenantAdminPage from "@/app/tenant-admin/page";

test("TenantAdmin shell: overview renders and section buttons toggle active state", async () => {
  render(<TenantAdminPage />);

  // basic shell content
  expect(screen.getByText(/Tenant Admin/i)).toBeInTheDocument();
  expect(screen.getByText(/Overview \(placeholder\)/i)).toBeInTheDocument();

  const itButton = screen.getByRole("button", { name: /IT Support/i });
  const billingButton = screen.getByRole("button", { name: /Billing/i });

  // switch to IT Support (wait for the dynamic module to load and settle)
  fireEvent.click(itButton);
  await screen.findByText(/IT Support control center/i);
  await waitFor(() => expect(itButton).toHaveClass("bg-[color:var(--foreground)]"));
  expect(itButton).toHaveClass("text-[color:var(--background)]");

  // switch to Billing (wait for billing module load and settle)
  fireEvent.click(billingButton);
  await screen.findByText(/Recent Invoices/i);
  await waitFor(() => expect(billingButton).toHaveClass("bg-[color:var(--foreground)]"));
  expect(billingButton).toHaveClass("text-[color:var(--background)]");
});