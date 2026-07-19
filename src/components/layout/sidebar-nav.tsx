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
import { useTenantPermissions } from "@/hooks/use-tenant-permissions";

const navigationItems = [
  {
    title: "Dashboard",
    href: "/tenant-admin",
    icon: Home,
    permission: "admin",
  },
  {
    title: "CRM",
    href: "/tenant-admin/crm",
    icon: Users,
    permission: "crm",
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
    permission: "finance",
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
    permission: "people",
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
    permission: "projects",
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
    permission: "crm",
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
    permission: "finance",
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
    permission: "automation",
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
    permission: "admin",
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
  userId?: string;
}

function canView(permission: string | undefined, perms: ReturnType<typeof useTenantPermissions>) {
  if (!permission) return true;
  if (perms.isAdmin) return true;
  if (permission.startsWith("dashboard:")) {
    return perms.dashboards.includes(permission.replace("dashboard:", ""));
  }
  const level = perms[permission as keyof typeof perms];
  return level !== "none" && level !== undefined;
}

export function SidebarNav({ className, userId }: SidebarNavProps) {
  const pathname = usePathname();
  const perms = useTenantPermissions(userId);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const visibleItems = navigationItems.filter((item) => canView(item.permission, perms));

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
      {visibleItems.map((item) => {
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
                  ? "bg-theme-accent-subtle text-theme-accent shadow-sm"
                  : "text-theme-sidebar-text hover:bg-theme-sidebar-hover hover:text-theme-sidebar-text-active hover:translate-x-1"
              )}
            >
              <Icon className={cn(
                "h-5 w-5 flex-shrink-0 transition-colors",
                isActive ? "text-theme-accent" : "text-theme-text-tertiary group-hover:text-theme-sidebar-text"
              )} />
              <span className="truncate font-medium">{item.title}</span>
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-theme-primary rounded-r-full"></div>
              )}
              {item.children && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    toggleSection(item.title);
                  }}
                  className="ml-auto p-1 hover:bg-theme-sidebar-hover rounded transition-colors"
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
                          ? "bg-theme-accent-subtle text-theme-accent font-medium shadow-sm"
                          : "text-theme-text-tertiary hover:bg-theme-sidebar-hover hover:text-theme-sidebar-text hover:translate-x-1"
                      )}
                    >
                      <span className="truncate">{child.title}</span>
                      {isChildActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-theme-primary rounded-r-full"></div>
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
