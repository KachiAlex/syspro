"use client";

import CRMDashboard from "../../sections/crm-dashboard";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

export default function LeadsPage() {
  const { tenantSlug } = useTenantContext();

  return <CRMDashboard tenantSlug={tenantSlug} initialTab="leads" />;
}
