"use client";

import CRMDashboard from "../../sections/crm-dashboard";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

export default function SalesPipelinePage() {
  const { tenantSlug } = useTenantContext();

  return <CRMDashboard tenantSlug={tenantSlug} initialTab="deals" />;
}
