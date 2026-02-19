/* @jest-environment jsdom */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

import AnalyticsSection from '@/app/tenant-admin/sections/analytics';

expect.extend(toHaveNoViolations);

beforeEach(() => {
  jest.spyOn(global, 'fetch').mockImplementation(() =>
    Promise.resolve({ ok: true, json: async () => ({ reports: [], exports: [] }) } as any)
  );
});

afterEach(() => {
  (global.fetch as jest.Mock).mockRestore();
});

test('AnalyticsSection renders Reports header and new-report CTA', async () => {
  render(<AnalyticsSection tenantSlug={undefined} />);

  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByText(/Loading reports…/i)).not.toBeInTheDocument());

  expect(screen.getByRole('heading', { level: 2, name: /^Reports$/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /New Report/i })).toBeInTheDocument();

  const results = await axe(document.body);
  expect(results).toHaveNoViolations();
});