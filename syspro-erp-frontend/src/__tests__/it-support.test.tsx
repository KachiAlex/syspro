/* @vitest-environment happy-dom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import ItSupportWorkspace from "@/app/tenant-admin/sections/it-support-workspace";

test("ItSupportWorkspace renders headings and form placeholders", () => {
  render(<ItSupportWorkspace tenantSlug={undefined} region={undefined} />);

  expect(screen.getByText(/IT Support control center/i)).toBeInTheDocument();
  expect(screen.getByText(/Log a new support ticket/i)).toBeInTheDocument();
});