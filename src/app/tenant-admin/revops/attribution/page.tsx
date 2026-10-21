"use client";

import RevOpsWorkspace from "@/app/tenant-admin/sections/revops-workspace";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

export default function AttributionPage() {
  const { tenantSlug } = useTenantContext();
  return <RevOpsWorkspace tenantSlug={tenantSlug} initialView="attribution" />;
}
