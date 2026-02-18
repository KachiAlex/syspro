import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { axe, toHaveNoViolations } from "jest-axe";

import { Panel, PillButton } from "@/components/ui/primitives";

expect.extend(toHaveNoViolations);

test("PillButton renders and Panel is accessible", async () => {
  render(
    <Panel className="test-panel">
      <PillButton variant="primary">Primary</PillButton>
      <PillButton variant="secondary">Secondary</PillButton>
    </Panel>
  );

  expect(screen.getByText(/Primary/i)).toBeInTheDocument();
  expect(screen.getByText(/Secondary/i)).toBeInTheDocument();

  const results = await axe(document.body);
  expect(results).toHaveNoViolations();
});