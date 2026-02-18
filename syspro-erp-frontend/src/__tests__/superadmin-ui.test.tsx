/* @jest-environment jsdom */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// mock next/router
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));

import SuperadminPage from "@/app/superadmin/page";

beforeEach(() => {
  jest.spyOn(global, "fetch").mockImplementation((input: RequestInfo) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.includes('/api/superadmin/tenants') && !url.includes('/admins')) {
      return Promise.resolve({ ok: true, json: async () => ([{ id: 1, name: 'ACME Corp', slug: 'acme', seats: 10, created_at: new Date().toISOString() }]) } as any);
    }
    if (url.includes('/api/superadmin/licenses')) {
      return Promise.resolve({ ok: true, json: async () => ([]) } as any);
    }
    if (url.includes('/admins')) {
      return Promise.resolve({ ok: true, json: async () => ([]) } as any);
    }
    return Promise.resolve({ ok: true, json: async () => ({}) } as any);
  });
});

afterEach(() => {
  (global.fetch as jest.Mock).mockRestore();
});

test('Superadmin page renders and tabs are accessible', async () => {
  render(<SuperadminPage />);

  // header
  expect(await screen.findByText(/Superadmin Portal/i)).toBeInTheDocument();

  // tenants tab should be active by default
  const tenantsTab = screen.getByRole('button', { name: /Tenants/i });
  expect(tenantsTab).toHaveAttribute('aria-pressed', 'true');

  // switch to Licenses
  const licensesTab = screen.getByRole('button', { name: /Licenses/i });
  fireEvent.click(licensesTab);
  await waitFor(() => expect(licensesTab).toHaveAttribute('aria-pressed', 'true'));

  // Add Tenant CTA present when tenants tab active
  fireEvent.click(screen.getByRole('button', { name: /Tenants/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /Add Tenant/i })).toBeInTheDocument());
});