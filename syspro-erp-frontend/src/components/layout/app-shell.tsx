"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, ShieldCheck } from "lucide-react";
import { PillButton, Tag } from "@/components/ui/primitives";
import type { ReactNode } from "react";

const opsLinks = [
  { label: "Planner", href: "/planner" },
  { label: "Suppliers", href: "/suppliers" },
  { label: "Tenant Admin", href: "/admin/tenant-admin" },
  { label: "People & Access", href: "/admin/people-access" },
  
];

const marketingLinks = [
  { label: "Platform", href: "#platform" },
  { label: "Neural Mesh", href: "#mesh" },
  { label: "AI Copilot", href: "#copilot" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const isMarketing = pathname === "/";
  const isAccess = pathname?.startsWith("/access");
  const isSuperadmin = pathname?.startsWith("/superadmin");
  
  // Show minimalist header only on relevant pages
  const showHeader = !isAccess && !isSuperadmin;

  return (
    <div className="text-[color:var(--foreground)]">
      {showHeader && (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  S
                </div>
                <span className="text-gray-900 font-semibold">Syspro</span>
              </Link>

              {/* Navigation */}
              <nav className="hidden md:flex items-center gap-8">
                <Link 
                  href="/" 
                  className={`text-sm font-medium transition-colors ${
                    pathname === "/" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Home
                </Link>
                <Link 
                  href="/access" 
                  className={`text-sm font-medium transition-colors ${
                    isAccess ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Login
                </Link>
              </nav>

              {/* CTA Button */}
              <Link href="/access">
                <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                  Sign In
                </button>
              </Link>
            </div>
          </div>
        </header>
      )}

      <div className={showHeader ? "pt-16" : ""}>{children}</div>
    </div>
  );
}
