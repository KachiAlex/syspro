import React from "react";
import Link from "next/link";

export function ServerSidebar({ className }: { className?: string }) {
  const items = [
    { title: "Dashboard", href: "/tenant-admin" },
    {
      title: "CRM",
      href: "/tenant-admin/crm",
      children: [
        { title: "Leads", href: "/tenant-admin/crm/leads" },
        { title: "Customers", href: "/tenant-admin/crm/customers" },
        { title: "Sales Pipeline", href: "/tenant-admin/crm/pipeline" },
      ],
    },
    {
      title: "Revenue Operations",
      href: "/tenant-admin/revops",
      children: [
        { title: "Campaigns", href: "/tenant-admin/revops/campaigns" },
        { title: "Attribution", href: "/tenant-admin/revops/attribution" },
        { title: "Sales Performance", href: "/tenant-admin/revops/performance" },
        { title: "Forecasting", href: "/tenant-admin/revops/forecasting" },
      ],
    },
    { title: "Projects", href: "/tenant-admin/projects" },
    {
      title: "Finance",
      href: "/tenant-admin/finance",
      children: [
        { title: "Overview", href: "/tenant-admin/finance" },
        { title: "Expenses", href: "/tenant-admin/expenses" },
        { title: "Bills", href: "/tenant-admin/bills" },
        { title: "Payments", href: "/tenant-admin/payments" },
        { title: "Reports", href: "/tenant-admin/finance/reports" },
      ],
    },
    { title: "Inventory", href: "/tenant-admin/inventory" },
    {
      title: "People & HR",
      href: "/tenant-admin/hr",
      children: [
        { title: "Staff", href: "/tenant-admin/hr/staff" },
        { title: "Attendance", href: "/tenant-admin/hr/attendance" },
        { title: "Payroll", href: "/tenant-admin/hr/payroll" },
      ],
    },
    {
      title: "IT Support",
      href: "/tenant-admin/it-support",
      children: [
        { title: "Ticketing", href: "/tenant-admin/it-support/tickets" },
        { title: "SLA Tracking", href: "/tenant-admin/it-support/sla" },
        { title: "Field Engineers", href: "/tenant-admin/it-support/engineers" },
        { title: "Incident Management", href: "/tenant-admin/it-support/incidents" },
      ],
    },
    {
      title: "Automation",
      href: "/tenant-admin/automation",
      children: [
        { title: "Rules", href: "/tenant-admin/automation/rules" },
        { title: "Policies", href: "/tenant-admin/automation/policies" },
        { title: "Workflow Triggers", href: "/tenant-admin/automation/triggers" },
      ],
    },
    { title: "Analytics", href: "/tenant-admin/analytics" },
    {
      title: "Admin",
      href: "/tenant-admin/admin",
      children: [
        { title: "Structure", href: "/tenant-admin/admin/structure" },
        { title: "Access Control", href: "/tenant-admin/admin/access" },
        { title: "Billing", href: "/tenant-admin/admin/billing" },
        { title: "Integrations", href: "/tenant-admin/admin/integrations" },
      ],
    },
  ];

  return (
    <nav className={"space-y-2 " + (className || "")} aria-label="Tenant navigation">
      {items.map((it) => (
        <div key={it.href}>
          <Link href={it.href} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {it.title}
          </Link>
          {it.children && (
            <div className="ml-6 mt-1 space-y-1">
              {it.children.map((c) => (
                <Link key={c.href} href={c.href} className="block px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 rounded-lg">
                  {c.title}
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}

export default ServerSidebar;
