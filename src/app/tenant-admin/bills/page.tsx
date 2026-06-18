"use client";

import React from "react";
import BillsComponent from "../sections/bills";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

export default function BillsPage() {
  const { tenantSlug } = useTenantContext();
  return <BillsComponent tenantSlug={tenantSlug} />;
}
