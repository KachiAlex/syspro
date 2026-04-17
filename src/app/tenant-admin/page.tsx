"use client";

import React from "react";
import TenantAdminClient from "./tenant-admin-client";

export default function Page() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-black mb-4">Admin Dashboard</h1>
      <p className="text-black">Welcome to your admin dashboard</p>
      <TenantAdminClient />
    </div>
  );
}
