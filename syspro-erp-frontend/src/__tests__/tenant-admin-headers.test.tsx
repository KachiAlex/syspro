import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

import { SectionHeading, PillButton } from '@/components/ui/primitives';

expect.extend(toHaveNoViolations);

test('SectionHeading + PillButton render and are accessible', async () => {
  render(
    <div>
      <SectionHeading
        eyebrow="Incidents"
        title="IT Support control center"
        description="Live ticket queue, SLA heatmap, dispatch radar and assignment intelligence."
      />
      <div style={{ marginTop: 8 }}>
        <PillButton variant="primary">New ticket</PillButton>
        <PillButton variant="secondary">Refresh</PillButton>
      </div>
    </div>
  );

  expect(screen.getByText(/IT Support control center/i)).toBeInTheDocument();
  expect(screen.getByText(/Incidents/i)).toBeInTheDocument();
  expect(screen.getByText(/New ticket/i)).toBeInTheDocument();

  const results = await axe(document.body);
  expect(results).toHaveNoViolations();
});