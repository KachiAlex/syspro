"use client";

import Inventory from "@/app/tenant-admin/sections/inventory";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

export default function InventoryPage() {
  const { tenantSlug } = useTenantContext();
  if (!tenantSlug) return null;
  return <Inventory tenantSlug={tenantSlug} />;
}
