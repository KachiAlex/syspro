"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  Users, 
  DollarSign, 
  UserCog, 
  FolderKanban, 
  Zap, 
  ShoppingCart, 
  Shield, 
  FileText, 
  Settings,
  BarChart3,
  Calendar,
  Building,
  CreditCard,
  Receipt,
  TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigationItems = [
  {
    title: "Dashboard",
    href: "/tenant-admin",
    icon: Home,
  },
  {
    title: "CRM",
    href: "/tenant-admin/crm",
    icon: Users,
    children: [
      { title: "Leads", href: "/tenant-admin/crm/leads" },
      { title: "Customers", href: "/tenant-admin/crm/customers" },
      { title: "Sales Pipeline", href: "/tenant-admin/crm/pipeline" },
    ]
  },
  {
    title: "Finance",
    href: "/tenant-admin/finance",
    icon: DollarSign,
    children: [
      { title: "Overview", href: "/tenant-admin/finance" },
      { title: "Expenses", href: "/tenant-admin/expenses" },
      { title: "Bills", href: "/tenant-admin/bills" },
      { title: "Payments", href: "/tenant-admin/payments" },
      { title: "Reports", href: "/tenant-admin/finance/reports" },
    ]
  },
  {
    title: "HR & Operations",
    href: "/tenant-admin/hr",
    icon: UserCog,
    children: [
      { title: "Staff", href: "/tenant-admin/hr/staff" },
      { title: "Attendance", href: "/tenant-admin/hr/attendance" },
      { title: "Reports", href: "/tenant-admin/hr/staff-reports" },
      { title: "Payroll", href: "/tenant-admin/hr/payroll" },
    ]
  },
  {
    title: "Projects",
    href: "/tenant-admin/projects",
    icon: FolderKanban,
    children: [
      { title: "Active Projects", href: "/tenant-admin/projects/active" },
      { title: "Archive", href: "/tenant-admin/projects/archive" },
      { title: "Reports", href: "/tenant-admin/projects/reports" },
    ]
  },
  {
    title: "Sales & Procurement",
    href: "/tenant-admin/sales",
    icon: ShoppingCart,
    children: [
      { title: "Sales Orders", href: "/tenant-admin/sales/orders" },
      { title: "Suppliers", href: "/tenant-admin/sales/suppliers" },
      { title: "Purchase Orders", href: "/tenant-admin/sales/purchase-orders" },
      { title: "Inventory", href: "/tenant-admin/sales/inventory" },
    ]
  },
  {
    title: "Reports & Analytics",
    href: "/tenant-admin/analytics",
    icon: BarChart3,
    children: [
      { title: "Dashboard", href: "/tenant-admin/analytics" },
      { title: "Financial Reports", href: "/tenant-admin/analytics/financial" },
      { title: "Sales Reports", href: "/tenant-admin/analytics/sales" },
      { title: "HR Reports", href: "/tenant-admin/analytics/hr" },
    ]
  },
  {
    title: "Automation",
    href: "/tenant-admin/automation",
    icon: Zap,
    children: [
      { title: "Workflows", href: "/tenant-admin/automation/workflows" },
      { title: "Rules", href: "/tenant-admin/automation/rules" },
      { title: "History", href: "/tenant-admin/automation/history" },
    ]
  },
  {
    title: "Admin",
    href: "/tenant-admin/admin",
    icon: Settings,
    children: [
      { title: "Settings", href: "/tenant-admin/settings" },
      { title: "Users & Roles", href: "/tenant-admin/users" },
      { title: "Audit Trail", href: "/tenant-admin/audit" },
      { title: "System Health", href: "/tenant-admin/health" },
    ]
  },
];

interface SidebarNavProps {
  className?: string;
}

export function SidebarNav({ className }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className={cn("space-y-2", className)}>
      {navigationItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        
        return (
          <div key={item.href}>
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                "touch-manipulation", // Improves touch responsiveness
                isActive
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">{item.title}</span>
            </Link>
            
            {item.children && (
              <div className="ml-6 mt-1 space-y-1">
                {item.children.map((child) => {
                  const isChildActive = pathname === child.href;
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors touch-manipulation",
                        isChildActive
                          ? "bg-blue-50 text-blue-600 font-medium"
                          : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                      )}
                    >
                      <span className="truncate">{child.title}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
