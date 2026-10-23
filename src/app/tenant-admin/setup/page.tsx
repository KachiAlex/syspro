"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  Circle,
  Loader2,
  Minus,
  RefreshCw,
  Rocket,
  SkipForward,
} from "lucide-react";

import { useTenantContext } from "@/components/tenant-admin/tenant-context";

type StepStatus = "pending" | "complete" | "skipped";

interface StepState {
  id: string;
  title: string;
  description: string;
  required: boolean;
  link: string;
  status: StepStatus;
  detail: string;
  skipped: boolean;
  schemaPending?: string;
  checkError?: boolean;
}

interface OnboardingState {
  tenantSlug: string;
  steps: StepState[];
  currentStep: string | null;
  dismissed: boolean;
  completedAt: string | null;
  schemaPending: string[];
  progress: { done: number; total: number; requiredDone: number; requiredTotal: number; percent: number };
}

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "complete")
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  if (status === "skipped")
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-theme-muted text-theme-text-tertiary">
        <Minus className="h-3.5 w-3.5" />
      </span>
    );
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-theme-border text-theme-text-secondary">
      <Circle className="h-3 w-3" />
    </span>
  );
}

const inputCls =
  "w-full rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text-primary focus:border-theme-accent focus:outline-none focus:ring-1 focus:ring-theme-accent";
const btnPrimary =
  "inline-flex items-center gap-2 rounded-lg bg-theme-accent px-4 py-2 text-sm font-medium text-white hover:bg-theme-accent-hover disabled:opacity-50";
const btnSecondary =
  "inline-flex items-center gap-2 rounded-lg border border-theme-border px-4 py-2 text-sm font-medium text-theme-text-primary hover:bg-theme-muted disabled:opacity-50";

export default function TenantSetupPage() {
  const { tenantSlug } = useTenantContext();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const qs = `tenantSlug=${encodeURIComponent(tenantSlug)}`;

  const refresh = useCallback(async () => {
    if (!tenantSlug) return;
    try {
      const res = await fetch(`/api/tenant/onboarding?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load onboarding state");
      setState(data);
      setError(null);
      setSelected((prev) => prev ?? data.currentStep ?? data.steps[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load onboarding state");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/tenant/onboarding?${qs}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Action failed");
        setState(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tenantSlug]
  );

  const callApi = useCallback(
    async (url: string, body: Record<string, unknown>, method = "POST") => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}${qs}`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, tenantSlug }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Action failed");
        await refresh();
        return data;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
        return null;
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tenantSlug, refresh]
  );

  const step = useMemo(
    () => state?.steps.find((s) => s.id === selected) ?? null,
    [state, selected]
  );

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-theme-accent" />
      </div>
    );
  }
  if (!state) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error || "Unable to load onboarding state."}
      </div>
    );
  }

  const pct = state.progress.percent;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-theme-text-primary">Setup &amp; Onboarding</h1>
          <p className="mt-1 text-sm text-theme-text-secondary">
            {state.completedAt
              ? "Setup completed — you can revisit any step below."
              : "Get the ERP foundations in place. Everything here can also be done from the normal admin sections."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className={btnSecondary}
            disabled={busy}
            onClick={() => post({ action: "reset" })}
            title="Clear skipped/dismissed flags (real data is untouched)"
          >
            <RefreshCw className="h-4 w-4" /> Reset
          </button>
          {!state.dismissed && !state.completedAt && (
            <button
              className={btnSecondary}
              disabled={busy}
              onClick={() => post({ action: "dismiss", dismissed: true })}
            >
              Dismiss checklist
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="mb-6 rounded-xl border border-theme-border bg-theme-surface p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-theme-text-primary">
            {state.progress.done} of {state.progress.total} steps
            <span className="ml-2 text-theme-text-tertiary">
              ({state.progress.requiredDone}/{state.progress.requiredTotal} required)
            </span>
          </span>
          <span className="font-semibold text-theme-accent">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-theme-muted">
          <div
            className="h-full rounded-full bg-theme-accent transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {state.schemaPending.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Database schema is behind — some checks could not run.</p>
          <p className="mt-1 text-amber-800">
            Apply the pending migration(s):{" "}
            {state.schemaPending.map((m) => (
              <code key={m} className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs">
                {m}
              </code>
            ))}
            then reload this page.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Stepper */}
        <ol className="space-y-1">
          {state.steps.map((s, i) => (
            <li key={s.id}>
              <button
                onClick={() => setSelected(s.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  selected === s.id
                    ? "bg-blue-50 ring-1 ring-blue-200"
                    : "hover:bg-theme-muted"
                }`}
              >
                <StatusIcon status={s.status} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-theme-text-primary">
                    {i + 1}. {s.title}
                  </span>
                  {s.required && s.status === "pending" && (
                    <span className="text-xs font-medium text-amber-600">Required</span>
                  )}
                  {s.skipped && <span className="text-xs text-theme-text-secondary">Skipped</span>}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-theme-text-primary" />
              </button>
            </li>
          ))}
        </ol>

        {/* Step panel */}
        {step && (
          <StepPanel
            step={step}
            state={state}
            busy={busy}
            tenantSlug={tenantSlug}
            post={post}
            callApi={callApi}
            refresh={refresh}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-step panels
// ---------------------------------------------------------------------------

function StepPanel({
  step,
  state,
  busy,
  tenantSlug,
  post,
  callApi,
  refresh,
}: {
  step: StepState;
  state: OnboardingState;
  busy: boolean;
  tenantSlug: string;
  post: (b: Record<string, unknown>) => Promise<void>;
  callApi: (url: string, b: Record<string, unknown>) => Promise<any>;
  refresh: () => Promise<void>;
}) {
  return (
    <section className="rounded-xl border border-theme-border bg-theme-surface p-6">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-theme-text-primary">{step.title}</h2>
        {step.required ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            Required
          </span>
        ) : (
          <span className="rounded-full bg-theme-muted px-2 py-0.5 text-xs font-medium text-theme-text-secondary">
            Optional
          </span>
        )}
      </div>
      <p className="mb-1 text-sm text-theme-text-secondary">{step.description}</p>
      <p
        className={`mb-4 text-sm ${
          step.status === "complete"
            ? "text-emerald-700"
            : step.schemaPending || step.checkError
              ? "text-amber-700"
              : "text-theme-text-tertiary"
        }`}
      >
        {step.detail}
      </p>

      {step.id === "profile" && <ProfileForm busy={busy} post={post} />}
      {step.id === "branches" && <BranchForm busy={busy} callApi={callApi} />}
      {step.id === "fiscal-periods" && (
        <FiscalYearForm busy={busy} tenantSlug={tenantSlug} refresh={refresh} />
      )}
      {step.id === "chart-of-accounts" && (
        <CoaSeed busy={busy} tenantSlug={tenantSlug} refresh={refresh} />
      )}
      {step.id === "warehouses" && <WarehouseForm busy={busy} callApi={callApi} />}
      {step.id === "currencies" && <CurrencyForm busy={busy} callApi={callApi} />}
      {step.id === "localization" && (
        <LocalizationSeed busy={busy} tenantSlug={tenantSlug} refresh={refresh} />
      )}
      {step.id === "team" && (
        <p className="mb-4 text-sm text-theme-text-secondary">
          Manage users and module access under{" "}
          <Link href="/tenant-admin/users" className="text-theme-accent hover:underline">
            Users
          </Link>{" "}
          and{" "}
          <Link href="/tenant-admin/admin" className="text-theme-accent hover:underline">
            Access control
          </Link>
          .
        </p>
      )}
      {step.id === "finance-policies" && (
        <p className="mb-4 text-sm text-theme-text-secondary">
          Configure payment terms, credit limits and dunning under{" "}
          <Link href="/tenant-admin/finance" className="text-theme-accent hover:underline">
            Finance
          </Link>
          . This is optional — you can set policies at any time.
        </p>
      )}
      {step.id === "opening-data" && (
        <p className="mb-4 text-sm text-theme-text-secondary">
          Add customers, vendors and products through the normal Finance / Inventory
          sections, or post opening balances via journal entries.
        </p>
      )}
      {step.id === "go-live" && <GoLive state={state} busy={busy} post={post} />}

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-theme-border pt-4">
        {!step.required &&
          (step.skipped ? (
            <button
              className={btnSecondary}
              disabled={busy}
              onClick={() => post({ action: "unskip", step: step.id })}
            >
              Unskip
            </button>
          ) : (
            step.status === "pending" && (
              <button
                className={btnSecondary}
                disabled={busy}
                onClick={() => post({ action: "skip", step: step.id })}
              >
                <SkipForward className="h-4 w-4" /> Skip for now
              </button>
            )
          ))}
        <Link href={step.link} className="ml-auto text-sm text-theme-accent hover:underline">
          Open full settings →
        </Link>
      </div>
    </section>
  );
}

function ProfileForm({
  busy,
  post,
}: {
  busy: boolean;
  post: (b: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: "",
    industry: "",
    region: "",
    baseCurrency: "",
    timezone: "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const body = Object.fromEntries(
          Object.entries(form).filter(([, v]) => v.trim() !== "")
        );
        post({ action: "profile", ...body });
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-theme-text-primary">Company name</span>
        <input className={inputCls} value={form.name} onChange={set("name")} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-theme-text-primary">Industry</span>
        <input className={inputCls} value={form.industry} onChange={set("industry")} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-theme-text-primary">Region</span>
        <input className={inputCls} value={form.region} onChange={set("region")} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-theme-text-primary">Base currency (e.g. NGN)</span>
        <input
          className={inputCls}
          maxLength={5}
          value={form.baseCurrency}
          onChange={set("baseCurrency")}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-theme-text-primary">
          Timezone (e.g. Africa/Lagos)
        </span>
        <input className={inputCls} value={form.timezone} onChange={set("timezone")} />
      </label>
      <div className="flex items-end">
        <button className={btnPrimary} disabled={busy} type="submit">
          Save profile
        </button>
      </div>
    </form>
  );
}

function BranchForm({
  busy,
  callApi,
}: {
  busy: boolean;
  callApi: (url: string, b: Record<string, unknown>) => Promise<any>;
}) {
  const [form, setForm] = useState({ name: "", code: "" });
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        callApi("/api/finance/branches", {
          name: form.name.trim(),
          code: form.code.trim() || undefined,
        }).then((r) => r && setForm({ name: "", code: "" }));
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-theme-text-primary">Branch name</span>
        <input
          className={inputCls}
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Headquarters"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-theme-text-primary">Code (optional)</span>
        <input
          className={inputCls}
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
          placeholder="HQ"
        />
      </label>
      <button className={btnPrimary} disabled={busy} type="submit">
        Create branch
      </button>
    </form>
  );
}

function FiscalYearForm({
  busy,
  tenantSlug,
  refresh,
}: {
  busy: boolean;
  tenantSlug: string;
  refresh: () => Promise<void>;
}) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [msg, setMsg] = useState<string | null>(null);
  const [busyLocal, setBusyLocal] = useState(false);
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusyLocal(true);
        setMsg(null);
        try {
          const res = await fetch(
            `/api/tenant/onboarding/seed-fiscal-year?tenantSlug=${encodeURIComponent(tenantSlug)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fiscalYear: year, tenantSlug }),
            }
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to generate fiscal year");
          setMsg(`FY${year}: ${data.inserted} period(s) created, ${data.skipped} already existed.`);
          await refresh();
        } catch (err) {
          setMsg(err instanceof Error ? err.message : "Failed");
        } finally {
          setBusyLocal(false);
        }
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-theme-text-primary">Fiscal year</span>
        <input
          className={inputCls}
          type="number"
          min={2000}
          max={2100}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        />
      </label>
      <button className={btnPrimary} disabled={busy || busyLocal} type="submit">
        Generate 12 monthly periods
      </button>
      {msg && <p className="w-full text-sm text-theme-text-secondary">{msg}</p>}
    </form>
  );
}

function CoaSeed({
  busy,
  tenantSlug,
  refresh,
}: {
  busy: boolean;
  tenantSlug: string;
  refresh: () => Promise<void>;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busyLocal, setBusyLocal] = useState(false);
  return (
    <div>
      <button
        className={btnPrimary}
        disabled={busy || busyLocal}
        onClick={async () => {
          setBusyLocal(true);
          setMsg(null);
          try {
            const res = await fetch(
              `/api/tenant/onboarding/seed-coa?tenantSlug=${encodeURIComponent(tenantSlug)}`,
              { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to seed chart of accounts");
            setMsg(`${data.inserted} account(s) created, ${data.skipped} already existed.`);
            await refresh();
          } catch (err) {
            setMsg(err instanceof Error ? err.message : "Failed");
          } finally {
            setBusyLocal(false);
          }
        }}
      >
        {busyLocal && <Loader2 className="h-4 w-4 animate-spin" />}
        Seed standard chart of accounts
      </button>
      {msg && <p className="mt-2 text-sm text-theme-text-secondary">{msg}</p>}
    </div>
  );
}

function WarehouseForm({
  busy,
  callApi,
}: {
  busy: boolean;
  callApi: (url: string, b: Record<string, unknown>) => Promise<any>;
}) {
  const [form, setForm] = useState({ name: "", code: "" });
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        callApi("/api/inventory/warehouses", {
          name: form.name.trim(),
          code: form.code.trim() || undefined,
        }).then((r) => r && setForm({ name: "", code: "" }));
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-theme-text-primary">Warehouse name</span>
        <input
          className={inputCls}
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Main Store"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-theme-text-primary">Code (optional)</span>
        <input
          className={inputCls}
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
          placeholder="MAIN"
        />
      </label>
      <button className={btnPrimary} disabled={busy} type="submit">
        Create warehouse
      </button>
    </form>
  );
}

function CurrencyForm({
  busy,
  callApi,
}: {
  busy: boolean;
  callApi: (url: string, b: Record<string, unknown>) => Promise<any>;
}) {
  const [form, setForm] = useState({
    currency: "",
    rateDate: new Date().toISOString().slice(0, 10),
    rate: "",
  });
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.currency.trim() || !form.rate) return;
        callApi("/api/finance/exchange-rates", {
          currency: form.currency.trim().toUpperCase(),
          rateDate: form.rateDate,
          rate: Number(form.rate),
        }).then((r) => r && setForm((f) => ({ ...f, currency: "", rate: "" })));
      }}
    >
      <p className="w-full text-sm text-theme-text-secondary">
        Register a non-base currency rate. Rates are looked up by effective date when
        multi-currency settlements post realized gain/loss.
      </p>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-theme-text-primary">Currency</span>
        <input
          className={inputCls}
          required
          maxLength={5}
          value={form.currency}
          onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
          placeholder="USD"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-theme-text-primary">Effective date</span>
        <input
          className={inputCls}
          type="date"
          value={form.rateDate}
          onChange={(e) => setForm((f) => ({ ...f, rateDate: e.target.value }))}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-theme-text-primary">Rate per base unit</span>
        <input
          className={inputCls}
          type="number"
          step="any"
          required
          value={form.rate}
          onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
          placeholder="1600"
        />
      </label>
      <button className={btnPrimary} disabled={busy} type="submit">
        Save rate
      </button>
    </form>
  );
}

function LocalizationSeed({
  busy,
  tenantSlug,
  refresh,
}: {
  busy: boolean;
  tenantSlug: string;
  refresh: () => Promise<void>;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busyLocal, setBusyLocal] = useState(false);
  return (
    <div>
      <button
        className={btnPrimary}
        disabled={busy || busyLocal}
        onClick={async () => {
          setBusyLocal(true);
          setMsg(null);
          try {
            const res = await fetch(
              `/api/finance/localization?tenantSlug=${encodeURIComponent(tenantSlug)}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ country: "NG", tenantSlug }),
              }
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to apply localization pack");
            setMsg(
              `Nigeria pack applied: ${data.taxRatesInserted} tax rate(s), ` +
              `statutory profile ${data.statutoryProfile}, ` +
              `${data.coaSeeded.inserted} account(s) seeded.`
            );
            await refresh();
          } catch (err) {
            setMsg(err instanceof Error ? err.message : "Failed");
          } finally {
            setBusyLocal(false);
          }
        }}
      >
        {busyLocal && <Loader2 className="h-4 w-4 animate-spin" />}
        Apply Nigeria defaults
      </button>
      {msg && <p className="mt-2 text-sm text-theme-text-secondary">{msg}</p>}
    </div>
  );
}

function GoLive({
  state,
  busy,
  post,
}: {
  state: OnboardingState;
  busy: boolean;
  post: (b: Record<string, unknown>) => Promise<void>;
}) {
  const pending = state.steps.filter((s) => s.required && s.status !== "complete");
  if (state.completedAt) {
    return (
      <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Setup marked complete on {new Date(state.completedAt).toLocaleDateString()}.
      </p>
    );
  }
  return (
    <div>
      {pending.length > 0 ? (
        <p className="mb-4 text-sm text-theme-text-secondary">
          Complete the remaining required steps first:{" "}
          <span className="font-medium text-amber-700">
            {pending.map((s) => s.title).join(", ")}
          </span>
        </p>
      ) : (
        <p className="mb-4 text-sm text-theme-text-secondary">
          All required foundations are in place. Completing setup hides the checklist
          banner — nothing else changes; the ERP already works.
        </p>
      )}
      <button
        className={btnPrimary}
        disabled={busy || pending.length > 0}
        onClick={() => post({ action: "complete" })}
      >
        <Rocket className="h-4 w-4" /> Mark setup complete
      </button>
    </div>
  );
}
