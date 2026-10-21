"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

import { useTenantContextSafe } from "@/components/tenant-admin/tenant-context";

interface BannerState {
  dismissed: boolean;
  completedAt: string | null;
  currentStep: string | null;
  steps: Array<{ id: string; title: string; status: string }>;
  progress: { done: number; total: number; percent: number };
}

/**
 * Slim onboarding checklist shown at the top of every tenant-admin page until
 * setup is complete or the admin dismisses it. Guides, never gates.
 */
export default function OnboardingBanner() {
  const { tenantSlug } = useTenantContextSafe();
  const pathname = usePathname();
  const [state, setState] = useState<BannerState | null>(null);
  const [hiding, setHiding] = useState(false);

  const load = useCallback(async () => {
    if (!tenantSlug) return;
    try {
      const res = await fetch(
        `/api/tenant/onboarding?tenantSlug=${encodeURIComponent(tenantSlug)}`
      );
      if (res.ok) setState(await res.json());
    } catch {
      // Banner is advisory — never surface errors here.
    }
  }, [tenantSlug]);

  useEffect(() => {
    load();
  }, [load]);

  if (!state || state.dismissed || state.completedAt || hiding) return null;
  if (pathname === "/tenant-admin/setup") return null; // wizard already on screen
  if (state.progress.percent >= 100) return null;

  const next = state.steps.find((s) => s.id === state.currentStep) ??
    state.steps.find((s) => s.status === "pending");

  const dismiss = async () => {
    setHiding(true);
    try {
      await fetch(
        `/api/tenant/onboarding?tenantSlug=${encodeURIComponent(tenantSlug)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "dismiss", dismissed: true }),
        }
      );
    } catch {
      setHiding(false);
    }
  };

  return (
    <div className="mb-4 flex items-center gap-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-blue-900">
          Finish setting up your workspace — {state.progress.done}/{state.progress.total} steps done
        </p>
        {next && (
          <p className="mt-0.5 truncate text-xs text-blue-700">
            Next: {next.title}
          </p>
        )}
        <div className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-blue-100">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${state.progress.percent}%` }}
          />
        </div>
      </div>
      <Link
        href="/tenant-admin/setup"
        className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        Continue setup
      </Link>
      <button
        onClick={dismiss}
        className="shrink-0 rounded-lg p-1.5 text-blue-500 hover:bg-blue-100"
        title="Dismiss checklist"
        aria-label="Dismiss onboarding checklist"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
