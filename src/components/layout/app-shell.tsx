"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, ShieldCheck } from "lucide-react";
import { PillButton, Tag } from "@/components/ui/primitives";
import type { ReactNode } from "react";

const opsLinks = [
  { label: "Planner", href: "/planner" },
  { label: "Suppliers", href: "/suppliers" },
];

const marketingLinks = [
  { label: "Platform", href: "#platform" },
  { label: "Neural Mesh", href: "#mesh" },
  { label: "AI Copilot", href: "#copilot" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const isMarketing = pathname === "/";
  const hideGlobalHeader = isMarketing || pathname?.startsWith("/tenant-admin");

  return (
    <div className="text-[color:var(--foreground)]">
      {!hideGlobalHeader && (
        <div className="app-header fixed inset-x-0 top-0 z-50 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
            <div className="flex items-center gap-4">
              <div className="rounded-full badge-accent px-3 py-1 text-xs font-semibold tracking-[0.4em] text-[color:var(--accent)]">
                SYS
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.5em] nav-muted">Neural ERP</p>
                <p className="text-lg font-semibold">Command Mesh</p>
              </div>
            </div>

            {isMarketing ? (
              <nav className="hidden items-center gap-6 text-sm nav-muted lg:flex">
                {marketingLinks.map((link) => (
                  <a key={link.label} href={link.href} className="hover:text-[color:var(--foreground)]">
                    {link.label}
                  </a>
                ))}
              </nav>
            ) : (
              <nav className="hidden items-center gap-2 rounded-full border muted-border glass px-2 py-1 text-sm lg:flex">
                {opsLinks.map((link) => {
                  const active = pathname === link.href;
                  return (
                    <Link
                      key={link.label}
                      href={link.href}
                      className={`rounded-full px-4 py-2 transition ${
                        active ? "bg-[color:var(--foreground)] text-[color:var(--background)]" : "nav-muted hover:text-[color:var(--foreground)]"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            )}

            <div className="flex items-center gap-3">
              {!isMarketing && (
                <>
                  <Tag tone="indigo">Ops Persona</Tag>
                  <button className="rounded-full border border-white/15 p-2 text-white/70 hover:text-white">
                    <Bell className="h-4 w-4" />
                  </button>
                  <button className="rounded-full border border-white/15 p-2 text-white/70 hover:text-white lg:hidden">
                    <Menu className="h-4 w-4" />
                  </button>
                  <div className="hidden items-center gap-3 rounded-full border muted-border glass px-3 py-1 text-xs nav-muted lg:flex">
                    <ShieldCheck className="h-4 w-4 text-emerald-300" />
                    Multi-tenant secure
                  </div>
                  <PillButton variant="secondary">Switch Persona</PillButton>
                </>
              )}
              <Link href="/access">
                <PillButton variant="primary">{isMarketing ? "Login" : "Access Portal"}</PillButton>
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className={hideGlobalHeader ? undefined : "pt-24"}>{children}</div>
    </div>
  );
}
