"use client";

import React from "react";
import ExpensesSection from "../sections/expenses";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

export default function ExpensesPage() {
  const { tenantSlug } = useTenantContext();
  return <ExpensesSection tenantSlug={tenantSlug} />;
}
