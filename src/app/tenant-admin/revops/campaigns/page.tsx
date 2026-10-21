"use client";

import RevOpsWorkspace from "@/app/tenant-admin/sections/revops-workspace";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

export default function CampaignsPage() {
  const { tenantSlug } = useTenantContext();
  return <RevOpsWorkspace tenantSlug={tenantSlug} initialView="campaigns" />;
}
