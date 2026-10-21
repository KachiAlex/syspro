"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, ChevronRight, Rocket, X } from "lucide-react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

type Step = { id: string; title: string; status: string; required: boolean; link: string };
type OnboardingState = {
  steps: Step[];
  currentStep: string | null;
  dismissed: boolean;
  completedAt: string | null;
  progress: { done: number; total: number; percent: number };
};

/**
 * Dashboard onboarding nudge: shows setup progress until the checklist is
 * complete or the admin dismisses it. Links into the setup wizard.
 */
export function OnboardingChecklist() {
  const { tenantSlug } = useTenantContext();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (!tenantSlug) return;
    fetch(`/api/tenant/onboarding?tenantSlug=${encodeURIComponent(tenantSlug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || data.dismissed || data.completedAt) return;
        if (data.progress?.percent >= 100) return;
        setState(data);
        setHidden(false);
      })
      .catch(() => {});
  }, [tenantSlug]);

  if (hidden || !state) return null;

  const current = state.steps.find((s) => s.id === state.currentStep)
    ?? state.steps.find((s) => s.status === "pending");
  const pct = state.progress?.percent ?? 0;

  const dismiss = async () => {
    setHidden(true);
    await fetch(`/api/tenant/onboarding?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss", dismissed: true }),
    }).catch(() => {});
  };

  return (
    <div className="gradient-card bg-theme-surface rounded-xl border border-theme-border p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
            <Rocket className="h-4.5 w-4.5 text-white" />
          </span>
          <div>
            <h2 className="font-semibold text-theme-text-primary">Finish setting up your workspace</h2>
            <p className="text-sm text-theme-text-secondary">
              {state.progress.done} of {state.progress.total} steps done
              {current ? ` — next: ${current.title}` : ""}
            </p>
          </div>
        </div>
        <button onClick={dismiss} className="text-theme-text-secondary hover:text-theme-text-primary" aria-label="Dismiss onboarding">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {state.steps.slice(0, 6).map((s) => (
          <Link
            key={s.id}
            href="/tenant-admin/setup"
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${
              s.status === "complete"
                ? "bg-emerald-500/10 text-emerald-400"
                : s.id === current?.id
                  ? "bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/40"
                  : "bg-[rgba(255,255,255,0.05)] text-theme-text-secondary"
            }`}
          >
            {s.status === "complete" && <CheckCircle className="h-3 w-3" />}
            {s.title}
          </Link>
        ))}
        <Link
          href="/tenant-admin/setup"
          className="ml-auto flex items-center gap-1 text-xs font-medium text-theme-accent hover:underline"
        >
          Continue setup <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
