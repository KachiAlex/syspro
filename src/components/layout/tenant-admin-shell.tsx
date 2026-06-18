"use client";

import React, { useState, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { SidebarNav } from "./sidebar-nav";
import { useTheme } from "@/components/theme/theme-provider";
import { Menu, X, ChevronDown, User, Bell, Settings, Search, Command, Home, ArrowRight, Sun, Moon } from "lucide-react";

interface TenantAdminShellProps {
  children: React.ReactNode;
  user?: {
    name?: string;
    email?: string;
    roleId?: string;
  } | null;
}

function useSidebarState() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("syspro:sidebar-collapsed");
    if (saved) setCollapsed(saved === "true");
  }, []);
  const toggle = () => {
    setCollapsed((prev) => {
      localStorage.setItem("syspro:sidebar-collapsed", String(!prev));
      return !prev;
    });
  };
  return { collapsed, toggle };
}

function useBreadcrumbs(pathname: string) {
  return useMemo(() => {
    if (!pathname) return [{ label: "Dashboard", href: "/tenant-admin" }];
    const segments = pathname.replace(/^\//, "").split("/").filter(Boolean);
    const crumbs: { label: string; href: string }[] = [{ label: "Dashboard", href: "/tenant-admin" }];
    let href = "";
    for (let i = 0; i < segments.length; i++) {
      href += "/" + segments[i];
      const label = segments[i]
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      if (i === 0 && segments[0] === "tenant-admin") continue;
      crumbs.push({ label, href });
    }
    return crumbs;
  }, [pathname]);
}

const QUICK_LINKS = [
  { label: "Finance Dashboard", href: "/tenant-admin/finance" },
  { label: "CRM Leads", href: "/tenant-admin/crm/leads" },
  { label: "Bills", href: "/tenant-admin/bills" },
  { label: "Expenses", href: "/tenant-admin/expenses" },
  { label: "HR Staff", href: "/tenant-admin/hr/staff" },
  { label: "Projects", href: "/tenant-admin/projects/active" },
  { label: "Users & Roles", href: "/tenant-admin/users" },
  { label: "Settings", href: "/tenant-admin/settings" },
];

export default function TenantAdminShell({ children, user }: TenantAdminShellProps) {
  const pathname = usePathname();
  const breadcrumbs = useBreadcrumbs(pathname || "");
  const { collapsed: sidebarCollapsed, toggle: toggleSidebar } = useSidebarState();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLinks = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return QUICK_LINKS.filter((l) => l.label.toLowerCase().includes(q));
  }, [searchQuery]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setSidebarOpen(false);
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
        event.preventDefault();
        toggleSidebar();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  const { theme, mounted: themeMounted, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex bg-theme-bg relative">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-theme-overlay backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Search Overlay */}
      {searchOpen && (
        <div
          className="fixed inset-0 bg-theme-overlay backdrop-blur-sm z-50"
          onClick={() => setSearchOpen(false)}
        >
          <div className="flex items-start justify-center pt-20">
            <div
              className="bg-white rounded-[14px] border border-slate-200 shadow-2xl w-full max-w-2xl mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <Search className="w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search anything..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 px-3 py-2 text-lg border-0 outline-none bg-transparent text-black placeholder-gray-500"
                    autoFocus
                  />
                  <button
                    onClick={() => setSearchOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs text-gray-500 border border-gray-200">Ctrl</kbd> + <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs text-gray-500 border border-gray-200">K</kbd> to open search
                </div>
                {/* Search Results */}
                <div className="border-t border-slate-200 pt-2 max-h-80 overflow-y-auto">
                  {filteredLinks.length > 0 ? (
                    <div className="py-2">
                      <p className="text-xs text-gray-500 px-2 mb-1">Quick Links</p>
                      {filteredLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-blue-50 transition-colors group"
                        >
                          <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-blue-600" />
                          <span className="text-sm text-black">{link.label}</span>
                        </Link>
                      ))}
                    </div>
                  ) : searchQuery ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No results for &quot;{searchQuery}&quot;
                    </p>
                  ) : (
                    <div className="py-2">
                      <p className="text-xs text-gray-500 px-2 mb-1">Quick Links</p>
                      {QUICK_LINKS.slice(0, 5).map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-blue-50 transition-colors group"
                        >
                          <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-blue-600" />
                          <span className="text-sm text-black">{link.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 border-r border-theme-sidebar-border bg-theme-sidebar-bg
        transform transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}
        w-64 flex flex-col h-screen
      `}>
        {/* Mobile header */}
        <div className="flex items-center justify-between p-4 border-b border-theme-sidebar-border lg:hidden">
          <span className="text-lg font-semibold text-theme-sidebar-text-active font-jakarta">Navigation</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg hover:bg-theme-sidebar-hover transition-colors"
          >
            <X className="h-5 w-5 text-theme-sidebar-text" />
          </button>
        </div>

        {/* Sidebar Header - Desktop */}
        <div className="hidden lg:block p-6 border-b border-theme-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#6366F1,#4F46E5)', boxShadow: '0 0 16px rgba(99,102,241,.4)' }}>
              <span className="text-white font-bold text-lg font-jakarta">S</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-theme-sidebar-text-active font-jakarta">Syspro</h2>
              <p className="text-sm text-theme-sidebar-text">Admin Dashboard</p>
            </div>
          </div>
        </div>

        {/* Scrollable Navigation */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[rgba(128,128,128,0.2)] scrollbar-track-transparent">
          <div className="p-4 lg:p-6">
            <SidebarNav />
          </div>
        </div>

        {/* Sidebar Footer - Desktop */}
        <div className="hidden lg:block border-t border-theme-sidebar-border p-4 bg-theme-muted">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-theme-surface rounded-full flex items-center justify-center border border-theme-border">
                <User className="w-4 h-4 text-theme-sidebar-text" />
              </div>
              <div>
                <p className="text-sm font-medium text-theme-sidebar-text-active">{user?.name || "Admin User"}</p>
                <p className="text-xs text-theme-text-tertiary">{user?.email || "admin@company.com"}</p>
              </div>
            </div>
            <button className="p-1.5 rounded-lg hover:bg-theme-sidebar-hover transition-colors">
              <ChevronDown className="w-4 h-4 text-theme-text-tertiary" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex-1 flex items-center justify-center gap-2 p-2 text-sm text-theme-sidebar-text hover:bg-theme-sidebar-hover rounded-lg transition-colors">
              <Bell className="w-4 h-4" />
              <span className="hidden lg:inline">Notifications</span>
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 p-2 text-sm text-theme-sidebar-text hover:bg-theme-sidebar-hover rounded-lg transition-colors">
              <Settings className="w-4 h-4" />
              <span className="hidden lg:inline">Settings</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {/* Top Bar */}
        <header className="bg-theme-bg border-b border-theme-border px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Mobile menu button */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-theme-sidebar-hover transition-colors"
              >
                <Menu className="h-5 w-5 text-theme-sidebar-text" />
              </button>

              {/* Desktop sidebar collapse toggle */}
              <button
                onClick={toggleSidebar}
                className="hidden lg:flex p-2 rounded-lg hover:bg-theme-sidebar-hover transition-colors"
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <Menu className="h-5 w-5 text-theme-sidebar-text" />
              </button>

              {/* Search Bar */}
              <button
                onClick={() => setSearchOpen(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-2 bg-theme-muted border border-theme-border rounded-[10px] hover:bg-theme-surface transition-colors min-w-0 max-w-xs"
              >
                <Search className="w-4 h-4 text-theme-text-tertiary" />
                <span className="text-sm text-theme-text-tertiary truncate">Search...</span>
                <kbd className="hidden md:flex items-center gap-1 px-1.5 py-0.5 bg-theme-muted border border-theme-border rounded text-xs text-theme-sidebar-text">
                  <Command className="w-3 h-3" />
                  K
                </kbd>
              </button>

              {/* Breadcrumb */}
              <nav className="hidden sm:flex items-center gap-2 text-sm text-theme-text-tertiary font-jakarta">
                {breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={crumb.href}>
                    {idx > 0 && <span className="text-theme-sidebar-text">/</span>}
                    {idx === breadcrumbs.length - 1 ? (
                      <span className="text-theme-sidebar-text-active">{crumb.label}</span>
                    ) : (
                      <Link href={crumb.href} className="hover:text-theme-sidebar-text-active transition-colors">
                        {crumb.label}
                      </Link>
                    )}
                  </React.Fragment>
                ))}
              </nav>
            </div>

            {/* Top bar actions */}
            <div className="flex items-center gap-3">
              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 text-theme-sidebar-text hover:text-theme-sidebar-text-active hover:bg-theme-sidebar-hover rounded-lg transition-colors"
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {themeMounted ? (
                  theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />
                ) : (
                  <span className="block w-5 h-5" />
                )}
              </button>
              <button className="relative p-2 text-theme-sidebar-text hover:text-theme-sidebar-text-active hover:bg-theme-sidebar-hover rounded-lg transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-theme-danger rounded-full"></span>
              </button>
              <button className="p-2 text-theme-sidebar-text hover:text-theme-sidebar-text-active hover:bg-theme-sidebar-hover rounded-lg transition-colors">
                <Settings className="w-5 h-5" />
              </button>
              <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-theme-border">
                <div className="w-8 h-8 bg-theme-surface rounded-full flex items-center justify-center border border-theme-border">
                  <User className="w-4 h-4 text-theme-sidebar-text" />
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-theme-sidebar-text-active">{user?.name || "Admin User"}</p>
                  <p className="text-xs text-theme-text-tertiary">{user?.roleId ? user.roleId.charAt(0).toUpperCase() + user.roleId.slice(1) : "Administrator"}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content - independently scrollable */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[rgba(128,128,128,0.2)] scrollbar-track-transparent dashboard-content">
          <div className="p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
