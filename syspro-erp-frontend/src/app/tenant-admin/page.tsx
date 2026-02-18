"use client";

import React, { useState, type ComponentType } from "react";
import dynamic from "next/dynamic";

// Dynamically import all available tenant-admin section components so the
// UI can be restored incrementally without re-introducing a single huge file.
const ItSupport = dynamic<ComponentType<any>>(() => import("./sections/it-support-workspace").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading IT Support…</div> });
const Billing = dynamic<ComponentType<any>>(() => import("./sections/billing").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Billing…</div> });
const Reports = dynamic<ComponentType<any>>(() => import("./sections/reports").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Reports…</div> });
const EmployeeConsole = dynamic<ComponentType<any>>(() => import("./sections/employee-console").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Employees…</div> });
const Integrations = dynamic<ComponentType<any>>(() => import("./sections/integrations").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Integrations…</div> });
const Analytics = dynamic<ComponentType<any>>(() => import("./sections/analytics").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Analytics…</div> });
const Workflows = dynamic<ComponentType<any>>(() => import("./sections/workflows").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Workflows…</div> });
const Security = dynamic<ComponentType<any>>(() => import("./sections/security").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Security…</div> });
const RoleBuilder = dynamic<ComponentType<any>>(() => import("./sections/role-builder").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Role Builder…</div> });
const RoleAssignment = dynamic<ComponentType<any>>(() => import("./sections/role-assignment").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Role Assignment…</div> });
const RevOps = dynamic<ComponentType<any>>(() => import("./sections/revops-workspace").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading RevOps…</div> });
const ModuleRegistry = dynamic<ComponentType<any>>(() => import("./sections/module-registry").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Modules…</div> });
const Marketing = dynamic<ComponentType<any>>(() => import("./sections/marketing-sales-dashboard").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Marketing…</div> });
const DepartmentManagement = dynamic<ComponentType<any>>(() => import("./sections/department-management").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Departments…</div> });
const CostAllocation = dynamic<ComponentType<any>>(() => import("./sections/cost-allocation").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Cost Allocation…</div> });
const BudgetPlanning = dynamic<ComponentType<any>>(() => import("./sections/budget-planning").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Budgets…</div> });
const AutomationRules = dynamic<ComponentType<any>>(() => import("./sections/automation-rules").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Automation Rules…</div> });
const AutomationDashboard = dynamic<ComponentType<any>>(() => import("./sections/automation-dashboard").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Automation Dashboard…</div> });
const ApprovalDesigner = dynamic<ComponentType<any>>(() => import("./sections/approval-designer").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Approvals…</div> });
const AdminRestrictions = dynamic<ComponentType<any>>(() => import("./sections/admin-restrictions").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Admin Restrictions…</div> });
const AdminControlCenter = dynamic<ComponentType<any>>(() => import("./sections/admin-control-center").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Admin Control…</div> });
const AccountingCOA = dynamic<ComponentType<any>>(() => import("./sections/accounting-coa").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Chart of Accounts…</div> });
const AccessControl = dynamic<ComponentType<any>>(() => import("./sections/access-control").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Access Control…</div> });

type SectionKey =
  | "overview"
  | "it-support"
  | "billing"
  | "reports"
  | "employees"
  | "integrations"
  | "analytics"
  | "workflows"
  | "security"
  | "role-builder"
  | "role-assignment"
  | "revops"
  | "modules"
  | "marketing"
  | "departments"
  | "cost-allocation"
  | "budgets"
  | "automation-rules"
  | "automation-dashboard"
  | "approvals"
  | "admin-restrictions"
  | "admin-control"
  | "accounting-coa"
  | "access-control";

export default function TenantAdminPage() {
  const [activeSection, setActiveSection] = useState<SectionKey>("overview");

  const sections: { key: SectionKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "it-support", label: "IT Support" },
    { key: "billing", label: "Billing" },
    { key: "reports", label: "Reports" },
    { key: "employees", label: "Employees" },
    { key: "integrations", label: "Integrations" },
    { key: "analytics", label: "Analytics" },
    { key: "workflows", label: "Workflows" },
    { key: "security", label: "Security" },
    { key: "role-builder", label: "Role Builder" },
    { key: "role-assignment", label: "Role Assignment" },
    { key: "revops", label: "RevOps" },
    { key: "modules", label: "Modules" },
    { key: "marketing", label: "Marketing" },
    { key: "departments", label: "Departments" },
    { key: "cost-allocation", label: "Cost Allocation" },
    { key: "budgets", label: "Budget Planning" },
    { key: "automation-rules", label: "Automation Rules" },
    { key: "automation-dashboard", label: "Automation Dashboard" },
    { key: "approvals", label: "Approvals" },
    { key: "admin-restrictions", label: "Admin Restrictions" },
    { key: "admin-control", label: "Admin Control" },
    { key: "accounting-coa", label: "Chart of Accounts" },
    { key: "access-control", label: "Access Control" },
  ];

  return (
    <div className="min-h-screen bg-[color:var(--background)] p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Tenant Admin</h1>
            <p className="text-sm text-slate-500">Restoring modules incrementally — pick a section to load.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {sections.map((s) => (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={`px-3 py-2 rounded-md text-sm font-medium ${activeSection === s.key ? "bg-[color:var(--foreground)] text-[color:var(--background)]" : "bg-[color:var(--background)] border muted-border text-muted"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-100 p-6 shadow-sm">
          {activeSection === "overview" && (
            <div className="text-center py-12">
              <h2 className="text-lg font-semibold">Overview (placeholder)</h2>
              <p className="mt-2 text-sm text-slate-500">Core dashboard will be restored one section at a time. Use the buttons above to enable a module.</p>
            </div>
          )}

          {activeSection === "it-support" && <ItSupport tenantSlug={undefined} region={undefined} />}
          {activeSection === "billing" && <Billing tenantSlug={undefined} />}
          {activeSection === "reports" && <Reports tenantSlug={undefined} />}
          {activeSection === "employees" && <EmployeeConsole tenantSlug={undefined} />}
          {activeSection === "integrations" && <Integrations tenantSlug={undefined} />}
          {activeSection === "analytics" && <Analytics tenantSlug={undefined} />}
          {activeSection === "workflows" && <Workflows tenantSlug={undefined} />}
          {activeSection === "security" && <Security tenantSlug={undefined} />}
          {activeSection === "role-builder" && <RoleBuilder tenantSlug={undefined} />}
          {activeSection === "role-assignment" && <RoleAssignment tenantSlug={undefined} />}
          {activeSection === "revops" && <RevOps tenantSlug={undefined} />}
          {activeSection === "modules" && <ModuleRegistry tenantSlug={undefined} />}
          {activeSection === "marketing" && <Marketing tenantSlug={undefined} />}
          {activeSection === "departments" && <DepartmentManagement tenantSlug={undefined} />}
          {activeSection === "cost-allocation" && <CostAllocation tenantSlug={undefined} />}
          {activeSection === "budgets" && <BudgetPlanning tenantSlug={undefined} />}
          {activeSection === "automation-rules" && <AutomationRules tenantSlug={undefined} />}
          {activeSection === "automation-dashboard" && <AutomationDashboard tenantSlug={undefined} />}
          {activeSection === "approvals" && <ApprovalDesigner tenantSlug={undefined} />}
          {activeSection === "admin-restrictions" && <AdminRestrictions tenantSlug={undefined} />}
          {activeSection === "admin-control" && <AdminControlCenter tenantSlug={undefined} />}
          {activeSection === "accounting-coa" && <AccountingCOA tenantSlug={undefined} />}
          {activeSection === "access-control" && <AccessControl tenantSlug={undefined} />}
        </div>
      </div>
    </div>
  );
}

export const TENANT_ADMIN_LEGACY_REMOVED = false;
