/* @jest-environment jsdom */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

import RevOpsWorkspace from '@/app/tenant-admin/sections/revops-workspace';

expect.extend(toHaveNoViolations);

beforeEach(() => {
  jest.spyOn(global, 'fetch').mockImplementation((input: RequestInfo) =>
    Promise.resolve({
      ok: true,
      json: async () => {
        const url = String(input);
        if (url.includes('/api/revops/overview')) return { overview: { metrics: [], revenueVsTarget: { period: 'Q1', actual: 0, target: 0 } } };
        if (url.includes('/api/revops/campaigns')) return { campaigns: [] };
        if (url.includes('/api/revops/lead-sources')) return { leadSources: [] };
        if (url.includes('/api/revops/sales-performance')) return { snapshot: null, targets: [] };
        if (url.includes('/api/revops/enablement-assets')) return { assets: [] };
        if (url.includes('/api/revops/forecast')) return { forecast: null };
        if (url.includes('/api/revops/attribution'))
          return { summary: { totals: { revenue: 0, spend: 0, roi: 0, opportunities: 0 }, campaigns: [], channels: [] } };
        return {};
      },
    } as any)
  );
});

afterEach(() => {
  (global.fetch as jest.Mock).mockRestore();
});

test('RevOpsWorkspace renders heading and refresh CTA', async () => {
  render(<RevOpsWorkspace tenantSlug={undefined} />);

  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByText(/Syncing RevOps telemetry…/i)).not.toBeInTheDocument());

  expect(screen.getByRole('heading', { name: /Revenue Operations \(RevOps\)/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Refresh data/i })).toBeInTheDocument();

  const results = await axe(document.body);
  expect(results).toHaveNoViolations();
});