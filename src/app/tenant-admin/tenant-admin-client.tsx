"use client";

import React, { useState } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { Users, CheckCircle, HardDrive, Server } from "lucide-react";

// Dynamically import heavy section components client-side
const HR = dynamic(() => import("./sections/hr").then((m) => m.default), { ssr: false });

type SectionKey =
  | "overview"
  | "crm"
  | "leads"
  | "contacts"
  | "invoices"
  | "payments"
  | "expenses"
  | "accounting"
  | "vendors"
  | "inventory"
  | "hr"
  | "projects"
  | "attendance";

export default function TenantAdminClient() {
  const searchParams = useSearchParams();
  const tenantSlug = (searchParams?.get("tenantSlug") as string) || "kreatix-default";
  const [activeSection, setActiveSection] = useState<SectionKey>("overview");

  const renderContent = () => {
    switch (activeSection) {
      case "overview":
        return (
          <div className="p-6 space-y-6">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-black">Dashboard Overview</h1>
              <p className="text-black mt-1">Welcome back! Here's your tenant system at a glance.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-black">Active Users</p>
                    <p className="text-2xl font-bold text-black mt-1">1,243</p>
                    <p className="text-sm text-green-600 mt-2">↑ 8% from last week</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-black">Licenses Used</p>
                    <p className="text-2xl font-bold text-black mt-1">890 / 1000</p>
                    <p className="text-sm text-black mt-2">89% capacity</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-black">Storage Usage</p>
                    <p className="text-2xl font-bold text-black mt-1">245 GB / 500 GB</p>
                    <p className="text-sm text-black mt-2">49% capacity</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <HardDrive className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-black">System Uptime</p>
                    <p className="text-2xl font-bold text-black mt-1">99.92%</p>
                    <p className="text-sm text-green-600 mt-2">This month</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Server className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case "hr":
      case "attendance":
        return <HR />;
      default:
        return <div className="p-6">Section not implemented yet.</div>;
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-black">Tenant: {tenantSlug}</h2>
        <div>
          <button onClick={() => setActiveSection("overview")} className="px-3 py-1 bg-gray-100 rounded mr-2">Overview</button>
          <button onClick={() => setActiveSection("hr")} className="px-3 py-1 bg-gray-100 rounded mr-2">People</button>
          <button onClick={() => setActiveSection("attendance")} className="px-3 py-1 bg-gray-100 rounded">Attendance</button>
        </div>
      </div>
      {renderContent()}
    </div>
  );
}
