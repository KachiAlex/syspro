"use client";

import React from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import ChartOfAccountsWorkspace from "@/app/tenant-admin/sections/accounting-coa";

export default function ChartOfAccountsPage() {
  const { tenantSlug } = useTenantContext();

  if (!tenantSlug) {
    return <div className="p-6 text-sm text-theme-text-secondary">Loading…</div>;
  }

  return (
    <div className="p-6">
      <ChartOfAccountsWorkspace tenantSlug={tenantSlug} />
    </div>
  );
}
