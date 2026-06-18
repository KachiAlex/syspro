"use client";

import React from "react";
import PaymentsSection from "../sections/payments";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

export default function PaymentsPage() {
  const { tenantSlug } = useTenantContext();
  return <PaymentsSection tenantSlug={tenantSlug} />;
}
