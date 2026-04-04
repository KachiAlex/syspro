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
  TrendingUp,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

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
      { title: "Payroll", href: "/tenant-admin/hr/payroll" },
      { title: "Reports", href: "/tenant-admin/hr/staff-reports" },
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
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (title: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(title)) {
        newSet.delete(title);
      } else {
        newSet.add(title);
      }
      return newSet;
    });
  };

  return (
    <nav className={cn("space-y-1", className)}>
      {navigationItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        const isCollapsed = collapsedSections.has(item.title);
        
        return (
          <div key={item.href} className="group">
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all duration-200",
                "touch-manipulation relative",
                isActive
                  ? "bg-blue-100 text-blue-700 shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 hover:translate-x-1"
              )}
            >
              <Icon className={cn(
                "h-5 w-5 flex-shrink-0 transition-colors",
                isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
              )} />
              <span className="truncate font-medium">{item.title}</span>
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-r-full"></div>
              )}
              {item.children && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    toggleSection(item.title);
                  }}
                  className="ml-auto p-1 hover:bg-gray-200 rounded transition-colors"
                >
                  <ChevronDown className={cn(
                    "w-4 h-4 transition-transform duration-200",
                    isCollapsed ? "rotate-0" : "rotate-180"
                  )} />
                </button>
              )}
            </Link>
            
            {item.children && !isCollapsed && (
              <div className="ml-6 mt-1 space-y-1">
                {item.children.map((child) => {
                  const isChildActive = pathname === child.href;
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-200 touch-manipulation relative",
                        isChildActive
                          ? "bg-blue-50 text-blue-600 font-medium shadow-sm"
                          : "text-gray-500 hover:bg-gray-50 hover:text-gray-700 hover:translate-x-1"
                      )}
                    >
                      <span className="truncate">{child.title}</span>
                      {isChildActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-blue-400 rounded-r-full"></div>
                      )}
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
