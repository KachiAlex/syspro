/* @jest-environment jsdom */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

import ModuleRegistry from '@/app/tenant-admin/sections/module-registry';

expect.extend(toHaveNoViolations);

beforeEach(() => {
  jest.spyOn(global, 'fetch').mockImplementation(() =>
    Promise.resolve({ ok: true, json: async () => ({ modules: [] }) } as any)
  );
});

afterEach(() => {
  (global.fetch as jest.Mock).mockRestore();
});

test('ModuleRegistry renders header and refresh button', async () => {
  render(<ModuleRegistry tenantSlug={undefined} />);

  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByText(/Loading modules…/i)).not.toBeInTheDocument());

  expect(screen.getByText(/System Modules & Features/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument();

  const results = await axe(document.body);
  expect(results).toHaveNoViolations();
});