"use client";

import ProcurementComponent from "@/app/tenant-admin/sections/procurement";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

export default function ProcurementPage() {
  const { tenantSlug } = useTenantContext();
  if (!tenantSlug) return null;
  return <ProcurementComponent tenantSlug={tenantSlug} />;
}
