"use client";

import dynamic from "next/dynamic";

const TenantAdmin = dynamic(() => import("@/app/tenant-admin/page").then((m) => m.default), { ssr: false });

export default function AdminTenantAdminPage() {
  return <TenantAdmin />;
}
