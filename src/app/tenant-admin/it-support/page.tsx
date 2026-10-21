"use client";

import ItSupportWorkspace from "@/app/tenant-admin/sections/it-support-workspace";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

export default function ITSupportPage() {
  const { tenantSlug } = useTenantContext();
  return <ItSupportWorkspace tenantSlug={tenantSlug} />;
}
