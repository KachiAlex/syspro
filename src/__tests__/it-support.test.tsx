import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

import ItSupportWorkspace from "@/app/tenant-admin/sections/it-support-workspace";

beforeEach(() => {
  jest.spyOn(global, "fetch").mockImplementation((input: RequestInfo) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.includes("/api/support/tickets")) {
      return Promise.resolve({ ok: true, json: async () => ({ tickets: [], totals: { count: 0, critical: 0, breached: 0, awaitingCustomer: 0 } }) } as any);
    }
    if (url.includes("/api/support/incidents")) {
      return Promise.resolve({ ok: true, json: async () => ({ incidents: [] }) } as any);
    }
    if (url.includes("/api/support/knowledge-base")) {
      return Promise.resolve({ ok: true, json: async () => ({ articles: [] }) } as any);
    }
    if (url.includes("/api/support/dashboard/metrics")) {
      return Promise.resolve({ ok: true, json: async () => ({ metrics: { totals: { ticketsOpen: 0, ticketsCritical: 0, slaBreaches: 0, fieldJobsActive: 0 }, sla: { atRisk: [] }, workload: [], incidents: { open: 0, items: [] } } }) } as any);
    }
    // fallback
    return Promise.resolve({ ok: true, json: async () => ({}) } as any);
  });
});

afterEach(() => {
  (global.fetch as jest.Mock).mockRestore();
});

test("ItSupportWorkspace renders headings and opens the create-ticket modal", async () => {
  const user = userEvent.setup();
  await act(async () => render(<ItSupportWorkspace tenantSlug={undefined} region={undefined} />));

  // wait for initial workspace load to finish, then assert heading
  await waitFor(() => expect(screen.queryByText(/Loading queue.../i)).not.toBeInTheDocument());
  expect(screen.getByText(/IT Support control center/i)).toBeInTheDocument();

  // open the create modal and assert modal heading appears
  const newBtn = screen.getByRole("button", { name: /New ticket/i });
  await user.click(newBtn);
  expect(await screen.findByText(/Log a new support ticket/i)).toBeInTheDocument();
});