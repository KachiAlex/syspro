"use client";

import React, { useState, type ComponentType } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { DataTable, type Column, type Action } from "@/components/ui/data-table";
import { 
  LayoutDashboard, 
  X,
  ChevronRight,
  Bell,
  Zap,
  Pin,
  Home,
  LogOut,
  Users,
  CreditCard,
  FileText,
  BarChart3,
  TrendingUp,
  Target,
  Package,
  Building,
  Calculator,
  PiggyBank,
  Database,
  Workflow,
  Bot,
  CheckCircle,
  HelpCircle,
  Plug,
  Shield,
  Lock,
  Settings,
  UserPlus,
  UserCheck,
  Star,
  Plus,
  Download,
  Eye,
  Edit,
  Trash2,
  Menu,
  Phone,
  Activity,
  AlertCircle,
  HardDrive,
  Clock,
  ArrowUp,
  ArrowRight,
  AlertTriangle,
  Server
} from "lucide-react";

// Dynamically import all available tenant-admin section components
const ItSupport = dynamic<ComponentType<any>>(() => import("./sections/it-support-workspace").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading IT Support…</div> });
const Billing = dynamic<ComponentType<any>>(() => import("./sections/billing").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Billing…</div> });
const Reports = dynamic<ComponentType<any>>(() => import("./sections/reports").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Reports…</div> });
const Expenses = dynamic<ComponentType<any>>(() => import("./sections/expenses").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Expenses…</div> });
const Payments = dynamic<ComponentType<any>>(() => import("./sections/payments").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Payments…</div> });
const Inventory = dynamic<ComponentType<any>>(() => import("./sections/inventory").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Inventory…</div> });
const Projects = dynamic<ComponentType<any>>(() => import("./sections/projects").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Projects…</div> });
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
const CRMDashboard = dynamic<ComponentType<any>>(() => import("./sections/crm-dashboard").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading CRM…</div> });
const DepartmentManagement = dynamic<ComponentType<any>>(() => import("./sections/department-management").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Departments…</div> });
const CostAllocation = dynamic<ComponentType<any>>(() => import("./sections/cost-allocation").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Cost Allocation…</div> });
const BudgetPlanning = dynamic<ComponentType<any>>(() => import("./sections/budget-planning").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Budgets…</div> });
const AutomationRules = dynamic<ComponentType<any>>(() => import("./sections/automation-rules").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Automation Rules…</div> });
const AutomationDashboard = dynamic<ComponentType<any>>(() => import("./sections/automation-dashboard").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Automation Dashboard…</div> });
const ApprovalsWorkspace = dynamic<ComponentType<any>>(() => import("./approvals/approvals-workspace").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Approvals…</div> });
const ApprovalDesigner = dynamic<ComponentType<any>>(() => import("./sections/approval-designer").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Approval Rules…</div> });
const AdminRestrictions = dynamic<ComponentType<any>>(() => import("./sections/admin-restrictions").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Admin Restrictions…</div> });
const AdminControlCenter = dynamic<ComponentType<any>>(() => import("./sections/admin-control-center").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Admin Control…</div> });
const HR = dynamic<ComponentType<any>>(() => import("./sections/hr").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading HR…</div> });
const Bills = dynamic<ComponentType<any>>(() => import("./sections/bills").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Bills…</div> });
const Accounting = dynamic<ComponentType<any>>(() => import("./sections/accounting").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Accounting…</div> });
const Attendance = dynamic<ComponentType<any>>(() => import("./sections/attendance").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Attendance…</div> });
const Vendors = dynamic<ComponentType<any>>(() => import("./sections/vendors").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Vendors…</div> });
const Procurement = dynamic<ComponentType<any>>(() => import("./sections/procurement").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Procurement…</div> });
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
  | "approval-rules"
  | "admin-restrictions"
  | "admin-control"
  | "accounting-coa"
  | "access-control"
  // CRM & Sales
  | "crm"
  | "leads"
  | "contacts"
  | "deals"
  // Finance & Accounting
  | "invoices"
  | "payments"
  | "expenses"
  | "accounting"
  // Procurement & Inventory
  | "vendors"
  | "procurement"
  | "purchase-orders"
  | "bills"
  | "inventory"
  // People & Organization
  | "hr"
  // Operations & Projects
  | "projects"
  | "attendance";

interface NavItem {
  key: SectionKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
}

const navItems: NavItem[] = [
  // Core Operations
  { key: "overview", label: "Overview", icon: LayoutDashboard, category: "Core" },
  { key: "analytics", label: "Analytics", icon: BarChart3, category: "Core" },
  { key: "reports", label: "Reports", icon: FileText, category: "Core" },
  
  // Business Management
  { key: "billing", label: "Billing", icon: CreditCard, category: "Business" },
  { key: "marketing", label: "Marketing", icon: TrendingUp, category: "Business" },
  { key: "revops", label: "Revenue Operations", icon: Target, category: "Business" },
  
  // CRM & Sales
  { key: "crm", label: "CRM", icon: Users, category: "CRM & Sales" },
  { key: "leads", label: "Leads", icon: UserPlus, category: "CRM & Sales" },
  { key: "contacts", label: "Contacts", icon: Users, category: "CRM & Sales" },
  { key: "deals", label: "Deals", icon: Target, category: "CRM & Sales" },
  
  // Finance & Accounting
  { key: "invoices", label: "Invoices", icon: FileText, category: "Finance" },
  { key: "payments", label: "Payments", icon: CreditCard, category: "Finance" },
  { key: "expenses", label: "Expenses", icon: Calculator, category: "Finance" },
  { key: "accounting", label: "Accounting", icon: Database, category: "Finance" },
  { key: "cost-allocation", label: "Cost Allocation", icon: Calculator, category: "Finance" },
  { key: "budgets", label: "Budget Planning", icon: PiggyBank, category: "Finance" },
  { key: "accounting-coa", label: "Chart of Accounts", icon: Database, category: "Finance" },
  
  // Procurement & Inventory
  { key: "vendors", label: "Vendors", icon: Building, category: "Procurement" },
  { key: "procurement", label: "Procurement", icon: Package, category: "Procurement" },
  { key: "purchase-orders", label: "Purchase Orders", icon: Package, category: "Procurement" },
  { key: "bills", label: "Bills", icon: FileText, category: "Procurement" },
  { key: "inventory", label: "Inventory", icon: Package, category: "Procurement" },
  
  // People & Organization
  { key: "employees", label: "Employees", icon: Users, category: "People" },
  { key: "departments", label: "Departments", icon: Building, category: "People" },
  { key: "hr", label: "Human Resources", icon: Users, category: "People" },
  { key: "attendance", label: "Attendance", icon: Clock, category: "People" },
  { key: "role-builder", label: "Role Builder", icon: UserPlus, category: "People" },
  { key: "role-assignment", label: "Role Assignment", icon: UserCheck, category: "People" },
  
  // Operations & Projects
  { key: "workflows", label: "Workflows", icon: Workflow, category: "Operations" },
  { key: "projects", label: "Projects", icon: Target, category: "Operations" },
  { key: "automation-rules", label: "Automation Rules", icon: Bot, category: "Operations" },
  { key: "automation-dashboard", label: "Automation Dashboard", icon: Bot, category: "Operations" },
  { key: "approvals", label: "Approvals", icon: CheckCircle, category: "Operations" },
  
  // Technical & Security
  { key: "it-support", label: "IT Support", icon: HelpCircle, category: "Technical" },
  { key: "integrations", label: "Integrations", icon: Plug, category: "Technical" },
  { key: "modules", label: "Modules", icon: Package, category: "Technical" },
  { key: "security", label: "Security", icon: Shield, category: "Technical" },
  { key: "access-control", label: "Access Control", icon: Lock, category: "Technical" },
  { key: "admin-restrictions", label: "Admin Restrictions", icon: Lock, category: "Technical" },
  { key: "admin-control", label: "Admin Control", icon: Settings, category: "Technical" },
];

export default function TenantAdminPage() {
  const searchParams = useSearchParams();
  const tenantSlug = searchParams?.get("tenantSlug") || "kreatix-default";
  const [activeSection, setActiveSection] = useState<SectionKey>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const groupedNavItems = navItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, NavItem[]>);

  const renderContent = () => {
    switch (activeSection) {

      case "overview":
        return (
          <div className="p-6 space-y-6">
            {/* Page Header */}
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
              <p className="text-gray-600 mt-1">Welcome back! Here's your tenant system at a glance.</p>
            </div>

            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Active Users */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Users</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">1,243</p>
                    <p className="text-sm text-green-600 mt-2">↑ 8% from last week</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              {/* License Usage */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Licenses Used</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">890 / 1000</p>
                    <p className="text-sm text-gray-600 mt-2">89% capacity</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              {/* Storage Usage */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Storage Usage</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">245 GB / 500 GB</p>
                    <p className="text-sm text-gray-600 mt-2">49% capacity</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <HardDrive className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>

              {/* System Uptime */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">System Uptime</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">99.92%</p>
                    <p className="text-sm text-green-600 mt-2">This month</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Server className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* System Health & Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* System Status */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium text-gray-700">All Systems</span>
                    </div>
                    <span className="text-sm font-semibold text-green-600">Operational</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium text-gray-700">Database</span>
                    </div>
                    <span className="text-sm font-semibold text-green-600">Optimal</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium text-gray-700">API Services</span>
                    </div>
                    <span className="text-sm font-semibold text-green-600">Running</span>
                  </div>
                  <div className="border-t pt-3 mt-3">
                    <p className="text-xs text-gray-600">Last backup: Today at 3:45 AM</p>
                  </div>
                </div>
              </div>

              {/* Operational Highlights */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Operational Highlights</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-amber-50 p-3 rounded">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-amber-600" />
                      <span className="text-sm text-gray-700">Pending Approvals</span>
                    </div>
                    <span className="text-lg font-bold text-amber-600">14</span>
                  </div>
                  <div className="flex items-center justify-between bg-blue-50 p-3 rounded">
                    <div className="flex items-center gap-2">
                      <Workflow className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-gray-700">Active Workflows</span>
                    </div>
                    <span className="text-lg font-bold text-blue-600">8</span>
                  </div>
                  <div className="flex items-center justify-between bg-purple-50 p-3 rounded">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-purple-600" />
                      <span className="text-sm text-gray-700">System Alerts</span>
                    </div>
                    <span className="text-lg font-bold text-purple-600">2</span>
                  </div>
                  <div className="flex items-center justify-between bg-green-50 p-3 rounded">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-gray-700">API Health</span>
                    </div>
                    <span className="text-lg font-bold text-green-600">Good</span>
                  </div>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Summary</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Revenue (This Month)</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">$48,250</p>
                    <p className="text-xs text-green-600 mt-1">↑ 12% vs last month</p>
                  </div>
                  <hr className="my-3" />
                  <div>
                    <p className="text-xs font-medium text-gray-600">Outstanding Invoices</p>
                    <p className="text-lg font-bold text-orange-600 mt-1">$12,450</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600">Pending Payments</p>
                    <p className="text-lg font-bold text-amber-600 mt-1">$8,900</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity & Module Usage */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity Feed */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  <div className="flex gap-3 pb-3 border-b">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <UserPlus className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">New user registered</p>
                      <p className="text-xs text-gray-600">john.smith@example.com</p>
                      <p className="text-xs text-gray-500 mt-1">2 hours ago</p>
                    </div>
                  </div>
                  <div className="flex gap-3 pb-3 border-b">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Report generated</p>
                      <p className="text-xs text-gray-600">Q1 2026 Financial Report</p>
                      <p className="text-xs text-gray-500 mt-1">5 hours ago</p>
                    </div>
                  </div>
                  <div className="flex gap-3 pb-3 border-b">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Workflow approved</p>
                      <p className="text-xs text-gray-600">Expense claim #12456</p>
                      <p className="text-xs text-gray-500 mt-1">1 day ago</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">System alert</p>
                      <p className="text-xs text-gray-600">Disk space at 89% capacity</p>
                      <p className="text-xs text-gray-500 mt-1">2 days ago</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Module Usage Overview */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Module Usage</h3>
                <div className="space-y-4">
                  {[
                    { name: "CRM & Sales", usage: 92, color: "bg-blue-500" },
                    { name: "Finance & Accounting", usage: 78, color: "bg-green-500" },
                    { name: "Procurement", usage: 65, color: "bg-purple-500" },
                    { name: "HR & People", usage: 54, color: "bg-orange-500" },
                    { name: "Workflows & Automation", usage: 48, color: "bg-pink-500" }
                  ].map((module) => (
                    <div key={module.name}>
                      <div className="flex justify-between mb-1">
                        <p className="text-sm font-medium text-gray-700">{module.name}</p>
                        <p className="text-sm font-semibold text-gray-900">{module.usage}%</p>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`${module.color} h-2 rounded-full`}
                          style={{ width: `${module.usage}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <button className="px-4 py-2 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition text-sm font-medium text-gray-700 flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Add User
                </button>
                <button className="px-4 py-2 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition text-sm font-medium text-gray-700 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  View Analytics
                </button>
                <button className="px-4 py-2 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Export Report
                </button>
                <button className="px-4 py-2 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Security
                </button>
                <button className="px-4 py-2 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Audit Logs
                </button>
                <button className="px-4 py-2 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
              </div>
            </div>
          </div>
        );
      case "crm":
        return <CRMDashboard tenantSlug={tenantSlug} initialTab="overview" />;
      case "leads":
        return <CRMDashboard tenantSlug={tenantSlug} initialTab="leads" />;
      case "contacts":
        return <CRMDashboard tenantSlug={tenantSlug} initialTab="contacts" />;
      case "deals":
        return <CRMDashboard tenantSlug={tenantSlug} initialTab="deals" />;
      case "invoices":
        return (
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Invoice Management</h2>
              <p className="text-gray-600">Create, manage, and track invoices with automated calculations and templates</p>
            </div>

            {/* Invoice Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Invoices</p>
                    <p className="text-xl font-bold text-gray-900">156</p>
                  </div>
                  <FileText className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Outstanding</p>
                    <p className="text-xl font-bold text-gray-900">$45,230</p>
                  </div>
                  <CreditCard className="w-8 h-8 text-orange-600" />
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Overdue</p>
                    <p className="text-xl font-bold text-gray-900">$12,450</p>
                  </div>
                  <Target className="w-8 h-8 text-red-600" />
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">This Month</p>
                    <p className="text-xl font-bold text-gray-900">$28,900</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-600" />
                </div>
              </div>
            </div>

            {/* Filters and Actions */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <select className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>All Status</option>
                    <option>Draft</option>
                    <option>Sent</option>
                    <option>Paid</option>
                    <option>Overdue</option>
                    <option>Cancelled</option>
                  </select>
                  <select className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>All Clients</option>
                    <option>Tech Corp</option>
                    <option>XYZ Inc</option>
                    <option>Global Tech</option>
                    <option>Startup Co</option>
                  </select>
                  <input 
                    type="text" 
                    placeholder="Search invoices..." 
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <Plus className="w-4 h-4 mr-2 inline" />
                    Create Invoice
                  </button>
                  <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                    <Download className="w-4 h-4 mr-2 inline" />
                    Export
                  </button>
                </div>
              </div>
            </div>

            {/* Invoices Table */}
            <DataTable
              data={[
                {
                  number: "INV-2024-001",
                  client: "Tech Corp",
                  amount: "$15,000.00",
                  status: "Paid",
                  dueDate: "2024-02-15",
                  created: "2024-02-01",
                  items: 5
                },
                {
                  number: "INV-2024-002",
                  client: "XYZ Inc",
                  amount: "$8,500.00",
                  status: "Sent",
                  dueDate: "2024-03-01",
                  created: "2024-02-15",
                  items: 3
                },
                {
                  number: "INV-2024-003",
                  client: "Global Tech",
                  amount: "$22,750.00",
                  status: "Overdue",
                  dueDate: "2024-02-10",
                  created: "2024-01-25",
                  items: 8
                },
                {
                  number: "INV-2024-004",
                  client: "Startup Co",
                  amount: "$4,200.00",
                  status: "Draft",
                  dueDate: "2024-03-15",
                  created: "2024-02-20",
                  items: 2
                },
                {
                  number: "INV-2024-005",
                  client: "Enterprise Ltd",
                  amount: "$18,900.00",
                  status: "Sent",
                  dueDate: "2024-02-28",
                  created: "2024-02-10",
                  items: 6
                }
              ]}
              columns={[
                {
                  key: "number",
                  title: "Invoice #",
                  sortable: true,
                  filterable: true,
                  render: (value, row) => (
                    <div>
                      <div className="font-medium text-slate-900">{value}</div>
                      <div className="text-sm text-slate-500">{row.items} items</div>
                    </div>
                  ),
                  width: "150px"
                },
                {
                  key: "client",
                  title: "Client",
                  sortable: true,
                  filterable: true,
                  width: "150px"
                },
                {
                  key: "amount",
                  title: "Amount",
                  sortable: true,
                  render: (value) => (
                    <span className="text-sm font-semibold text-slate-900">{value}</span>
                  ),
                  width: "120px",
                  align: "right"
                },
                {
                  key: "status",
                  title: "Status",
                  sortable: true,
                  filterable: true,
                  render: (value) => (
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      value === 'Paid' ? 'bg-green-100 text-green-800' :
                      value === 'Sent' ? 'bg-blue-100 text-blue-800' :
                      value === 'Overdue' ? 'bg-red-100 text-red-800' :
                      value === 'Draft' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {value}
                    </span>
                  ),
                  width: "120px"
                },
                {
                  key: "dueDate",
                  title: "Due Date",
                  sortable: true,
                  width: "120px"
                },
                {
                  key: "created",
                  title: "Created",
                  sortable: true,
                  width: "120px"
                }
              ]}
              actions={[
                {
                  key: "view",
                  label: "View Invoice",
                  icon: <Eye className="w-4 h-4" />,
                  onClick: (row) => console.log("View invoice:", row),
                  variant: "primary"
                },
                {
                  key: "edit",
                  label: "Edit Invoice",
                  icon: <Edit className="w-4 h-4" />,
                  onClick: (row) => console.log("Edit invoice:", row),
                  variant: "secondary"
                },
                {
                  key: "download",
                  label: "Download Invoice",
                  icon: <Download className="w-4 h-4" />,
                  onClick: (row) => console.log("Download invoice:", row),
                  variant: "secondary"
                },
                {
                  key: "delete",
                  label: "Delete Invoice",
                  icon: <Trash2 className="w-4 h-4" />,
                  onClick: (row) => console.log("Delete invoice:", row),
                  variant: "danger"
                }
              ]}
              searchable={true}
              searchPlaceholder="Search invoices..."
              filterable={true}
              sortable={true}
              paginated={true}
              pageSize={5}
              exportable={true}
              exportFormats={["csv", "excel", "pdf", "json"]}
              emptyMessage="No invoices found"
              onRowClick={(row) => console.log("Row clicked:", row)}
            />

            {/* Invoice Templates */}
            <div className="mt-8 bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Templates</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    name: "Standard Invoice",
                    description: "Basic invoice template for regular billing",
                    usage: "45 invoices",
                    icon: FileText
                  },
                  {
                    name: "Proforma Invoice",
                    description: "Preliminary invoice before final billing",
                    usage: "12 invoices",
                    icon: FileText
                  },
                  {
                    name: "Recurring Invoice",
                    description: "Template for recurring monthly billing",
                    usage: "28 invoices",
                    icon: FileText
                  }
                ].map((template, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-3">
                      <template.icon className="w-6 h-6 text-blue-600" />
                      <h4 className="font-medium text-gray-900">{template.name}</h4>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{template.usage}</span>
                      <button className="text-sm text-blue-600 hover:text-blue-800">Use Template</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Invoice Activities */}
            <div className="mt-8 bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Invoice Activities</h3>
              <div className="space-y-4">
                {[
                  {
                    action: "Invoice paid",
                    invoice: "INV-2024-001",
                    client: "Tech Corp",
                    amount: "$15,000.00",
                    time: "2 hours ago",
                    icon: CheckCircle,
                    color: "text-green-600"
                  },
                  {
                    action: "Invoice sent",
                    invoice: "INV-2024-005",
                    client: "Enterprise Ltd",
                    amount: "$18,900.00",
                    time: "4 hours ago",
                    icon: FileText,
                    color: "text-blue-600"
                  },
                  {
                    action: "Payment reminder sent",
                    invoice: "INV-2024-003",
                    client: "Global Tech",
                    amount: "$22,750.00",
                    time: "1 day ago",
                    icon: Bell,
                    color: "text-orange-600"
                  },
                  {
                    action: "Invoice created",
                    invoice: "INV-2024-004",
                    client: "Startup Co",
                    amount: "$4,200.00",
                    time: "2 days ago",
                    icon: Plus,
                    color: "text-purple-600"
                  }
                ].map((activity, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <activity.icon className={`w-5 h-5 ${activity.color}`} />
                      <div>
                        <p className="font-medium text-gray-900">{activity.action}</p>
                        <p className="text-sm text-gray-600">{activity.invoice} • {activity.client}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{activity.amount}</p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case "payments":
        return <Payments tenantSlug={tenantSlug} />;
      case "expenses":
        return <Expenses tenantSlug={tenantSlug} />;
      case "inventory":
        return <Inventory tenantSlug={tenantSlug} />;
      case "accounting":
        return <Accounting tenantSlug={tenantSlug} />;
      case "vendors":
        return <Vendors tenantSlug={tenantSlug} />;
      case "procurement":
        return <Procurement tenantSlug={tenantSlug} />;
      case "vendors":
        return <Vendors tenantSlug={tenantSlug} />;
      case "procurement":
        return <Procurement tenantSlug={tenantSlug} />;
      case "inventory":
        return (
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Inventory Management</h2>
              <p className="text-gray-600">Track stock levels, manage product catalog, and optimize inventory</p>
            </div>

            {/* Inventory Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Products</p>
                    <p className="text-xl font-bold text-gray-900">1,234</p>
                  </div>
                  <Package className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Low Stock Items</p>
                    <p className="text-xl font-bold text-gray-900">45</p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-orange-600" />
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Value</p>
                    <p className="text-xl font-bold text-gray-900">$456,789</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-600" />
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Out of Stock</p>
                    <p className="text-xl font-bold text-gray-900">12</p>
                  </div>
                  <XCircle className="w-8 h-8 text-red-600" />
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
              <div className="flex flex-wrap gap-3">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <Plus className="w-4 h-4 mr-2 inline" />
                  Add Product
                </button>
                <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                  <Package className="w-4 h-4 mr-2 inline" />
                  Stock Adjustment
                </button>
                <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                  <Target className="w-4 h-4 mr-2 inline" />
                  Reorder Items
                </button>
                <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                  <Download className="w-4 h-4 mr-2 inline" />
                  Export
                </button>
              </div>
            </div>

            {/* Filters and Search */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <select className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>All Categories</option>
                    <option>Electronics</option>
                    <option>Office Supplies</option>
                    <option>Furniture</option>
                    <option>Raw Materials</option>
                    <option>Finished Goods</option>
                  </select>
                  <select className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>All Stock Status</option>
                    <option>In Stock</option>
                    <option>Low Stock</option>
                    <option>Out of Stock</option>
                    <option>Discontinued</option>
                  </select>
                  <input 
                    type="text" 
                    placeholder="Search products..." 
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                    <Filter className="w-4 h-4 mr-2 inline" />
                    More Filters
                  </button>
                </div>
              </div>
            </div>

            {/* Inventory Table */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Product Inventory</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Showing 1-10 of 1,234</span>
                  <button className="text-blue-600 hover:text-blue-800">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Level</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reorder Point</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {[
                      {
                        sku: "LAP-001",
                        productName: "Dell Latitude Laptop",
                        category: "Electronics",
                        stockLevel: 45,
                        reorderPoint: 20,
                        unitPrice: "$1,299.00",
                        totalValue: "$58,455.00",
                        status: "In Stock",
                        lastUpdated: "2024-02-22"
                      },
                      {
                        sku: "OFF-002",
                        productName: "Ergonomic Office Chair",
                        category: "Furniture",
                        stockLevel: 12,
                        reorderPoint: 15,
                        unitPrice: "$450.00",
                        totalValue: "$5,400.00",
                        status: "Low Stock",
                        lastUpdated: "2024-02-21"
                      },
                      {
                        sku: "PEN-003",
                        productName: "Ballpoint Pens (Box of 100)",
                        category: "Office Supplies",
                        stockLevel: 0,
                        reorderPoint: 50,
                        unitPrice: "$12.50",
                        totalValue: "$0.00",
                        status: "Out of Stock",
                        lastUpdated: "2024-02-20"
                      },
                      {
                        sku: "MON-004",
                        productName: "27\" Monitor",
                        category: "Electronics",
                        stockLevel: 78,
                        reorderPoint: 30,
                        unitPrice: "$299.00",
                        totalValue: "$23,322.00",
                        status: "In Stock",
                        lastUpdated: "2024-02-19"
                      },
                      {
                        sku: "RAW-005",
                        productName: "Steel Sheets",
                        category: "Raw Materials",
                        stockLevel: 234,
                        reorderPoint: 100,
                        unitPrice: "$45.00",
                        totalValue: "$10,530.00",
                        status: "In Stock",
                        lastUpdated: "2024-02-18"
                      },
                      {
                        sku: "FIN-006",
                        productName: "Assembled Desk Unit",
                        category: "Finished Goods",
                        stockLevel: 8,
                        reorderPoint: 10,
                        unitPrice: "$890.00",
                        totalValue: "$7,120.00",
                        status: "Low Stock",
                        lastUpdated: "2024-02-17"
                      }
                    ].map((product, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{product.sku}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{product.productName}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{product.category}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{product.stockLevel}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{product.reorderPoint}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">{product.unitPrice}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">{product.totalValue}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            product.status === 'In Stock' ? 'bg-green-100 text-green-800' :
                            product.status === 'Low Stock' ? 'bg-yellow-100 text-yellow-800' :
                            product.status === 'Out of Stock' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {product.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button className="text-blue-600 hover:text-blue-800">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button className="text-green-600 hover:text-green-800">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button className="text-purple-600 hover:text-purple-800">
                              <Package className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Inventory Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Low Stock Alerts</h3>
                <div className="space-y-4">
                  {[
                    {
                      sku: "OFF-002",
                      productName: "Ergonomic Office Chair",
                      currentStock: 12,
                      reorderPoint: 15,
                      category: "Furniture",
                      priority: "Medium"
                    },
                    {
                      sku: "PEN-003",
                      productName: "Ballpoint Pens (Box of 100)",
                      currentStock: 0,
                      reorderPoint: 50,
                      category: "Office Supplies",
                      priority: "High"
                    },
                    {
                      sku: "FIN-006",
                      productName: "Assembled Desk Unit",
                      currentStock: 8,
                      reorderPoint: 10,
                      category: "Finished Goods",
                      priority: "Medium"
                    },
                    {
                      sku: "STA-007",
                      productName: "Standing Desk",
                      currentStock: 3,
                      reorderPoint: 8,
                      category: "Furniture",
                      priority: "High"
                    }
                  ].map((alert, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            alert.priority === 'High' ? 'bg-red-100 text-red-800' :
                            alert.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {alert.priority}
                          </span>
                          <h4 className="font-medium text-gray-900">{alert.sku}</h4>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{alert.productName}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{alert.category}</span>
                          <span>Current: {alert.currentStock}</span>
                          <span>Reorder at: {alert.reorderPoint}</span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors">
                          Reorder
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory by Category</h3>
                <div className="space-y-3">
                  {[
                    { category: "Electronics", value: "$125,450", percentage: 27, color: "bg-blue-500" },
                    { category: "Furniture", value: "$98,234", percentage: 22, color: "bg-green-500" },
                    { category: "Raw Materials", value: "$87,678", percentage: 19, color: "bg-purple-500" },
                    { category: "Office Supplies", value: "$65,432", percentage: 14, color: "bg-orange-500" },
                    { category: "Finished Goods", value: "$80,000", percentage: 18, color: "bg-red-500" }
                  ].map((cat, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-900 w-24">{cat.category}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${cat.color}`}
                          style={{ width: `${cat.percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 w-20 text-right">{cat.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Stock Movements */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Recent Stock Movements</h3>
                <button className="text-sm text-blue-600 hover:text-blue-800">View All</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {[
                      {
                        date: "2024-02-22",
                        product: "Dell Latitude Laptop",
                        type: "In",
                        quantity: 10,
                        reference: "PO-2024-045",
                        user: "Alex Johnson"
                      },
                      {
                        date: "2024-02-21",
                        product: "Ergonomic Office Chair",
                        type: "Out",
                        quantity: 3,
                        reference: "SO-2024-089",
                        user: "Sarah Williams"
                      },
                      {
                        date: "2024-02-20",
                        product: "Ballpoint Pens",
                        type: "Out",
                        quantity: 50,
                        reference: "SO-2024-088",
                        user: "Mike Chen"
                      },
                      {
                        date: "2024-02-19",
                        product: "27\" Monitor",
                        type: "In",
                        quantity: 25,
                        reference: "PO-2024-044",
                        user: "Emily Davis"
                      },
                      {
                        date: "2024-02-18",
                        product: "Steel Sheets",
                        type: "Adjustment",
                        quantity: -5,
                        reference: "ADJ-2024-001",
                        user: "Robert Wilson"
                      }
                    ].map((movement, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{movement.date}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{movement.product}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            movement.type === 'In' ? 'bg-green-100 text-green-800' :
                            movement.type === 'Out' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {movement.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{movement.quantity}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{movement.reference}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{movement.user}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Inventory Activities */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Inventory Activities</h3>
              <div className="space-y-4">
                {[
                  {
                    action: "Stock received",
                    details: "10 units of Dell Latitude Laptop",
                    reference: "PO-2024-045",
                    time: "2 hours ago",
                    icon: Package,
                    color: "text-green-600"
                  },
                  {
                    action: "Low stock alert",
                    details: "Ergonomic Office Chair below reorder point",
                    reference: "AUTO-ALERT",
                    time: "4 hours ago",
                    icon: AlertCircle,
                    color: "text-orange-600"
                  },
                  {
                    action: "Stock adjustment",
                    details: "5 units of Steel Sheets adjusted",
                    reference: "ADJ-2024-001",
                    time: "1 day ago",
                    icon: Calculator,
                    color: "text-blue-600"
                  },
                  {
                    action: "Product added",
                    details: "New product: Standing Desk",
                    reference: "PROD-NEW-001",
                    time: "2 days ago",
                    icon: Plus,
                    color: "text-purple-600"
                  },
                  {
                    action: "Stock depleted",
                    details: "Ballpoint Pens out of stock",
                    reference: "AUTO-ALERT",
                    time: "3 days ago",
                    icon: XCircle,
                    color: "text-red-600"
                  }
                ].map((activity, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <activity.icon className={`w-5 h-5 ${activity.color}`} />
                      <div>
                        <p className="font-medium text-gray-900">{activity.action}</p>
                        <p className="text-sm text-gray-600">{activity.details}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{activity.reference}</p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case "hr":
        return <HR tenantSlug={tenantSlug} />;
      case "attendance":
        return <Attendance tenantSlug={tenantSlug} />;
      case "projects":
      case "projects":
        return <Projects tenantSlug={tenantSlug} />;
      case "it-support": return <ItSupport tenantSlug={tenantSlug} region={undefined} />;
      case "billing": return <Billing tenantSlug={tenantSlug} />;
      case "reports": return <Reports tenantSlug={tenantSlug} />;
      case "employees": return <EmployeeConsole tenantSlug={tenantSlug} />;
      case "integrations": return <Integrations tenantSlug={tenantSlug} />;
      case "analytics": return <Analytics tenantSlug={tenantSlug} />;
      case "workflows": return <Workflows tenantSlug={tenantSlug} />;
      case "security": return <Security tenantSlug={tenantSlug} />;
      case "role-builder": return <RoleBuilder tenantSlug={tenantSlug} />;
      case "role-assignment": return <RoleAssignment tenantSlug={tenantSlug} />;
      case "revops": return <RevOps tenantSlug={tenantSlug} />;
      case "modules": return <ModuleRegistry tenantSlug={tenantSlug} />;
      case "marketing": return <Marketing tenantSlug={tenantSlug} />;
      case "departments": return <DepartmentManagement tenantSlug={tenantSlug} />;
      case "cost-allocation": return <CostAllocation tenantSlug={tenantSlug} />;
      case "budgets": return <BudgetPlanning tenantSlug={tenantSlug} />;
      case "automation-rules": return <AutomationRules tenantSlug={tenantSlug} />;
      case "automation-dashboard": return <AutomationDashboard tenantSlug={tenantSlug} />;
      case "approvals": return <ApprovalsWorkspace tenantSlug={tenantSlug} onNavigateTo={setActiveSection} />;
      case "approval-rules": return <ApprovalDesigner tenantSlug={tenantSlug} />;
      case "admin-restrictions": return <AdminRestrictions tenantSlug={tenantSlug} />;
      case "admin-control": return <AdminControlCenter tenantSlug={tenantSlug} />;
      case "accounting-coa": return <AccountingCOA tenantSlug={tenantSlug} />;
      case "access-control": return <AccessControl tenantSlug={tenantSlug} />;
      default:
        return <div className="p-6">Section not implemented</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {renderContent()}
    </div>
  );
}