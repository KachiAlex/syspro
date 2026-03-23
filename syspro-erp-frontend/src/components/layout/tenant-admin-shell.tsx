"use client";

import React from "react";
import { SidebarNav } from "./sidebar-nav";

export default function TenantAdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-64 border-r border-gray-200 bg-white p-6 overflow-y-auto">
        <SidebarNav />
      </aside>
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}
