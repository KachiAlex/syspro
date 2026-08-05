"use client";

import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import Manufacturing from "@/app/tenant-admin/sections/manufacturing";

export default function ManufacturingPage() {
  const { tenantSlug } = useTenantContext();
  return <Manufacturing tenantSlug={tenantSlug ?? ""} />;
}
