"use client";

import React, { useState, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { SidebarNav, navigationItems, canView } from "./sidebar-nav";
import { ROUTE_INDEX } from "@/lib/nav/route-index";
import { useTheme } from "@/components/theme/theme-provider";
import { useTenantPermissions } from "@/hooks/use-tenant-permissions";
import { AIChatPanel } from "@/components/ai/ai-chat-panel";
import OnboardingBanner from "@/components/tenant-admin/onboarding-banner";
import { Menu, X, User, Bell, Settings, Search, Command, Home, ArrowRight, Sun, Moon, LogOut, Sparkles } from "lucide-react";
import { NotificationBell } from "./notification-bell";

interface TenantAdminShellProps {
  children: React.ReactNode;
  user?: {
    id?: string;
    name?: string;
    email?: string;
    roleId?: string;
  } | null;
}

function useSidebarState() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("pisairtel:sidebar-collapsed");
    if (saved) setCollapsed(saved === "true");
  }, []);
  const toggle = () => {
    setCollapsed((prev) => {
      localStorage.setItem("pisairtel:sidebar-collapsed", String(!prev));
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

/** Synonyms → href: terms users naturally type that don't appear verbatim
 *  in any nav title (workflow → approvals, routing → approvals, …). */
const SEARCH_ALIASES: Record<string, { label: string; href: string }> = {
  approval: { label: "Approvals & Routing", href: "/tenant-admin/approvals" },
  approvals: { label: "Approvals & Routing", href: "/tenant-admin/approvals" },
  approve: { label: "Approvals & Routing", href: "/tenant-admin/approvals" },
  workflow: { label: "Approvals & Routing", href: "/tenant-admin/approvals" },
  routing: { label: "Approvals & Routing", href: "/tenant-admin/approvals" },
  "sign off": { label: "Approvals & Routing", href: "/tenant-admin/approvals" },
  signoff: { label: "Approvals & Routing", href: "/tenant-admin/approvals" },
  authorize: { label: "Approvals & Routing", href: "/tenant-admin/approvals" },
  delegation: { label: "Approvals & Routing", href: "/tenant-admin/approvals" },
  officer: { label: "Approvals & Routing", href: "/tenant-admin/approvals" },
  onboarding: { label: "Tenant Setup / Onboarding", href: "/tenant-admin/setup" },
  setup: { label: "Tenant Setup / Onboarding", href: "/tenant-admin/setup" },
  audit: { label: "Audit Trail", href: "/tenant-admin/audit" },
  export: { label: "Tenant Setup / Onboarding", href: "/tenant-admin/setup" },
  roles: { label: "Users & Roles", href: "/tenant-admin/users" },
  permission: { label: "Users & Roles", href: "/tenant-admin/users" },
  permissions: { label: "Users & Roles", href: "/tenant-admin/users" },
  employee: { label: "HR Staff", href: "/tenant-admin/hr/staff" },
  staff: { label: "HR Staff", href: "/tenant-admin/hr/staff" },
  leave: { label: "Leave", href: "/tenant-admin/hr/leave" },
  holiday: { label: "Leave", href: "/tenant-admin/hr/leave" },
  payslip: { label: "Payroll", href: "/tenant-admin/hr/payroll" },
  salary: { label: "Payroll", href: "/tenant-admin/hr/payroll" },
  invoice: { label: "Sales", href: "/tenant-admin/sales" },
  stock: { label: "Inventory", href: "/tenant-admin/inventory" },
  warehouse: { label: "Warehouses", href: "/tenant-admin/warehouses" },
  supplier: { label: "Suppliers", href: "/tenant-admin/suppliers" },
  vendor: { label: "Vendors", href: "/tenant-admin/vendors" },
  purchase: { label: "Purchase Orders", href: "/tenant-admin/sales/purchase-orders" },
  receipt: { label: "Purchases", href: "/tenant-admin/purchases" },
  report: { label: "Reports & Analytics", href: "/tenant-admin/analytics" },
  budget: { label: "Budget vs Actual", href: "/tenant-admin/budget-vs-actual" },
  tax: { label: "Tax", href: "/tenant-admin/tax" },
  asset: { label: "Fixed Assets", href: "/tenant-admin/assets" },
  reconcile: { label: "Bank Recon", href: "/tenant-admin/bank-reconciliation" },
  notification: { label: "Notifications", href: "/tenant-admin/notifications" },
};

function getDashboardKey(pathname: string): string | null {
  if (pathname === '/tenant-admin' || pathname.startsWith('/tenant-admin/admin') || pathname.startsWith('/tenant-admin/users') || pathname.startsWith('/tenant-admin/settings') || pathname.startsWith('/tenant-admin/audit') || pathname.startsWith('/tenant-admin/health')) return 'admin';
  if (pathname.startsWith('/tenant-admin/automation')) return 'automation';
  if (pathname.startsWith('/tenant-admin/finance') || pathname.startsWith('/tenant-admin/expenses') || pathname.startsWith('/tenant-admin/bills') || pathname.startsWith('/tenant-admin/payments') || pathname.startsWith('/tenant-admin/billing')) return 'finance';
  if (pathname.startsWith('/tenant-admin/hr')) return 'people';
  if (pathname.startsWith('/tenant-admin/crm')) return 'crm';
  if (pathname.startsWith('/tenant-admin/projects')) return 'projects';
  if (pathname.startsWith('/tenant-admin/analytics')) return 'analytics';
  if (pathname.startsWith('/tenant-admin/sales') || pathname.startsWith('/tenant-admin/inventory')) return 'sales';
  return null;
}

export default function TenantAdminShell({ children, user }: TenantAdminShellProps) {
  const pathname = usePathname();
  const [safePath, setSafePath] = useState<string | null>(null);
  useEffect(() => { setSafePath(pathname); }, [pathname]);
  const breadcrumbs = useBreadcrumbs(safePath || "");
  const { collapsed: sidebarCollapsed, toggle: toggleSidebar } = useSidebarState();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [aiChatOpen, setAiChatOpen] = useState(false);

  const [searchHits, setSearchHits] = useState<{ entity: string; id: string; title: string; subtitle?: string; href: string }[]>([]);
  const perms = useTenantPermissions();

  // Navigation search: every sidebar page the user can see, plus synonym
  // aliases (workflow → approvals, …) — deduped, capped at 12.
  // Navigation search: every page in the app (nav tree + generated route
  // index covering non-sidebar pages) + synonym aliases. Multi-token AND
  // matching ("bank recon" works). Permission-filtered like the sidebar —
  // non-nav routes inherit their parent section's module permission.
  const filteredLinks = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const tokens = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    const match = (hay: string) => tokens.every((t) => hay.includes(t));
    const hits: { label: string; href: string }[] = [];
    const seen = new Set<string>();
    const push = (label: string, href: string, section?: string) => {
      if (seen.has(href)) return;
      seen.add(href);
      hits.push({ label: section ? `${label} — ${section}` : label, href });
    };

    // module permission for a route: longest nav-group href prefix, else
    // a keyword→module inference from the path, else unrestricted.
    const navHrefPerms = (navigationItems as any[])
      .filter((g) => g.href)
      .map((g) => ({ href: g.href as string, permission: g.permission as string | undefined, title: g.title as string }))
      .sort((a, b) => b.href.length - a.href.length);
    const KEYWORD_MODULE: Array<[RegExp, string]> = [
      [/finance|expense|bill|payment|tax|treasury|bank|budget|period|imprest|recurring|asset|ledger|coa|return|credit|equity|pricing|deferred/, "finance"],
      [/hr|leave|payroll|staff|attendance|roster|recruit|promotion|team/, "people"],
      [/inventory|warehouse|stock|landed|material/, "inventory"],
      [/manufactur|work-order|mrp|batch|quality|subcontract/, "manufacturing"],
      [/sales|crm|pos|deliver|order|quotation|promotion|storefront|procurement|rfq|purchase|supplier|vendor/, "sales"],
      [/project|gantt|task/, "projects"],
      [/it-support|ticket|incident|sla|engineer/, "itsupport"],
      [/automation|workflow/, "automation"],
      [/analytic|report/, "analytics"],
      [/revops|campaign|attribution|forecast/, "revops"],
      [/admin|setting|user|audit|notif|health|platform|setup|custom-field|team-data/, "admin"],
    ];
    const permFor = (href: string): string | undefined => {
      const pref = navHrefPerms.find((g) => href === g.href || href.startsWith(g.href + "/"));
      if (pref) return pref.permission;
      for (const [re, mod] of KEYWORD_MODULE) if (re.test(href)) return mod;
      return undefined;
    };

    const hayFor = (label: string, href: string, section?: string) =>
      `${label} ${href} ${section ?? ""}`.toLowerCase();

    for (const r of ROUTE_INDEX) {
      if (!canView(permFor(r.href), perms)) continue;
      if (match(hayFor(r.label, r.href, r.section))) push(r.label, r.href, r.section);
    }
    for (const group of navigationItems as any[]) {
      if (!canView(group.permission, perms)) continue;
      for (const child of group.children ?? []) {
        if (match(hayFor(child.title, child.href, group.title))) push(child.title, child.href, group.title);
      }
    }
    for (const [term, dest] of Object.entries(SEARCH_ALIASES)) {
      if (tokens.some((t) => term.includes(t) || t.includes(term))) push(dest.label, dest.href);
    }
    return hits.slice(0, 15);
  }, [searchQuery, perms]);

  // Global entity search — debounced /api/search call.
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) { setSearchHits([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setSearchHits(d.hits ?? []))
        .catch(() => setSearchHits([]));
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'j') {
        event.preventDefault();
        setAiChatOpen((prev) => !prev);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setSidebarOpen(false);
        setAiChatOpen(false);
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
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    const expire = "expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;";
    document.cookie = `X-User-Id=; ${expire}`;
    document.cookie = `dev-user-id=; ${expire}`;
    document.cookie = `userId=; ${expire}`;
    document.cookie = `X-Role-Id=; ${expire}`;
    document.cookie = `X-User-Email=; ${expire}`;
    document.cookie = `tenantSlug=; ${expire}`;
    document.cookie = `X-Tenant-Slug=; ${expire}`;
    document.cookie = `employee_tenant=; ${expire}`;
    // Call server-side logout to clear httpOnly session cookies
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore — proceed with redirect anyway
    }
    window.location.href = "/login";
  };

  const dashboardKey = getDashboardKey(safePath || '');

  // Role-based route access:
  // - Admin role: full access to all routes
  // - Non-admin roles: only access routes for modules activated in portal_permissions
  // - The base /tenant-admin route is always allowed — the page component
  //   decides whether to show the admin dashboard or employee dashboard
  const isDashboardRoute = dashboardKey === 'admin' && (safePath === '/tenant-admin' || safePath === '');
  const allowed =
    !safePath ||
    perms.loading ||
    !dashboardKey ||
    isDashboardRoute ||
    perms.isAdmin ||
    (perms.employeeModules && perms.employeeModules[dashboardKey] === true);

  if (!mounted) {
    return <div className="min-h-screen bg-theme-bg" />;
  }

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
              className="bg-theme-surface rounded-[14px] border border-theme-border shadow-2xl w-full max-w-2xl mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <Search className="w-5 h-5 text-theme-text-secondary" />
                  <input
                    type="text"
                    placeholder="Search anything..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 px-3 py-2 text-lg border-0 outline-none bg-transparent text-theme-text-primary placeholder-theme-text-tertiary"
                    autoFocus
                  />
                  <button
                    onClick={() => setSearchOpen(false)}
                    className="p-2 hover:bg-theme-muted rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-theme-text-secondary" />
                  </button>
                </div>
                <div className="text-xs text-theme-text-secondary mb-2">
                  Press <kbd className="px-1 py-0.5 bg-theme-muted rounded text-xs text-theme-text-secondary border border-theme-border">Ctrl</kbd> + <kbd className="px-1 py-0.5 bg-theme-muted rounded text-xs text-theme-text-secondary border border-theme-border">K</kbd> to open search
                </div>
                {/* Search Results */}
                <div className="border-t border-theme-border pt-2 max-h-80 overflow-y-auto">
                  {searchHits.length > 0 && (
                    <div className="py-2">
                      <p className="text-xs text-theme-text-secondary px-2 mb-1">Records</p>
                      {searchHits.map((hit) => (
                        <Link
                          key={`${hit.entity}-${hit.id}`}
                          href={hit.href}
                          onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-theme-muted transition-colors group"
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-theme-text-tertiary w-16 shrink-0">{hit.entity}</span>
                          <span className="text-sm text-theme-text-primary">{hit.title}</span>
                          {hit.subtitle && <span className="text-xs text-theme-text-tertiary truncate">{hit.subtitle}</span>}
                        </Link>
                      ))}
                    </div>
                  )}
                  {filteredLinks.length > 0 ? (
                    <div className="py-2">
                      <p className="text-xs text-theme-text-secondary px-2 mb-1">Quick Links</p>
                      {filteredLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-theme-muted transition-colors group"
                        >
                          <ArrowRight className="w-4 h-4 text-theme-text-secondary group-hover:text-theme-accent" />
                          <span className="text-sm text-theme-text-primary">{link.label}</span>
                        </Link>
                      ))}
                    </div>
                  ) : searchQuery && searchHits.length === 0 ? (
                    <p className="text-sm text-theme-text-secondary text-center py-4">
                      No results for &quot;{searchQuery}&quot;
                    </p>
                  ) : (
                    <div className="py-2">
                      <p className="text-xs text-theme-text-secondary px-2 mb-1">Quick Links</p>
                      {QUICK_LINKS.slice(0, 5).map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-theme-muted transition-colors group"
                        >
                          <ArrowRight className="w-4 h-4 text-theme-text-secondary group-hover:text-theme-accent" />
                          <span className="text-sm text-theme-text-primary">{link.label}</span>
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
            <Image src="/pisairtel-erp-badge.svg" alt="Pisairtel ERP" width={40} height={40} style={{ borderRadius: '50%', objectFit: 'cover' }} />
            <div>
              <h2 className="text-lg font-bold text-theme-sidebar-text-active font-jakarta">Pisairtel ERP</h2>
              <p className="text-sm text-theme-sidebar-text">{perms.isAdmin ? "Admin Dashboard" : "Employee Portal"}</p>
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
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg hover:bg-theme-sidebar-hover transition-colors"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4 text-theme-text-tertiary" />
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

              {/* Search Bar - Desktop */}
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

              {/* Search Button - Mobile */}
              <button
                onClick={() => setSearchOpen(true)}
                className="sm:hidden p-2 rounded-lg hover:bg-theme-sidebar-hover transition-colors"
              >
                <Search className="h-5 w-5 text-theme-sidebar-text" />
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
              {/* AI Assistant button */}
              <button
                onClick={() => setAiChatOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm"
                title="AI Assistant (Ctrl+J)"
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">AI Assistant</span>
              </button>

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
              <NotificationBell />
              <button className="p-2 text-theme-sidebar-text hover:text-theme-sidebar-text-active hover:bg-theme-sidebar-hover rounded-lg transition-colors hidden sm:block">
                <Settings className="w-5 h-5" />
              </button>
              <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-theme-border">
                <button
                  onClick={handleLogout}
                  className="w-8 h-8 bg-theme-surface rounded-full flex items-center justify-center border border-theme-border hover:bg-theme-sidebar-hover transition-colors"
                  title="Logout"
                  aria-label="Logout"
                >
                  <User className="w-4 h-4 text-theme-sidebar-text" />
                </button>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-theme-sidebar-text-active">{user?.name || "Admin User"}</p>
                  <p className="text-xs text-theme-text-tertiary">{user?.roleId ? user.roleId.charAt(0).toUpperCase() + user.roleId.slice(1) : "Administrator"}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-theme-sidebar-text hover:text-theme-sidebar-text-active hover:bg-theme-sidebar-hover rounded-lg transition-colors"
                  title="Logout"
                  aria-label="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page content - independently scrollable */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[rgba(128,128,128,0.2)] scrollbar-track-transparent dashboard-content">
          <div className="p-4 sm:p-6 lg:p-8">
            {perms.loading ? (
              <div className="flex items-center justify-center h-full min-h-[50vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme-accent"></div>
              </div>
            ) : allowed ? (
              <>
                <OnboardingBanner />
                {children}
              </>
            ) : (
              <div className="p-8 bg-theme-surface rounded-xl border border-theme-border max-w-xl">
                <h2 className="text-lg font-semibold text-theme-text-primary">Access Denied</h2>
                <p className="text-sm text-theme-text-secondary mt-2">You do not have permission to view this dashboard.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* AI Chat Panel */}
      <AIChatPanel open={aiChatOpen} onClose={() => setAiChatOpen(false)} />
    </div>
  );
}
