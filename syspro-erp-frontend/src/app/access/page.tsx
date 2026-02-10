"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, KeySquare, Shield, UserCircle } from "lucide-react";

const steps = [
  {
    title: "Authenticate",
    detail: "Tenant SSO or superadmin hardware key",
  },
  {
    title: "Route",
    detail: "We detect persona + tenant context",
  },
  {
    title: "Launch",
    detail: "Jump into planner, supplier, or oversight surfaces",
  },
];

const personas = {
  tenant: {
    title: "Tenant workspace",
    description: "Plant, finance, ESG, and supplier personas land in their tenant-scoped mesh.",
    cta: "Continue to tenant workspace",
    helper: "We mint tenant tokens, enforce ledger isolation, and drop you inside /tenant in one step.",
  },
  superadmin: {
    title: "Superadmin command",
    description: "Mint tenants, seed copilots, and audit policies from the oversight console.",
    cta: "Launch superadmin mesh",
    helper: "Email + password unlock /superadmin. Hardware keys prompt post-auth for sensitive ops.",
  },
} as const;

function normalizeTenantSlug(value: string) {
  const trimmed = value.trim().toLowerCase();
  return trimmed.replace(/[^a-z0-9-]+/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
}

export default function AccessPage() {
  const [persona, setPersona] = useState<"tenant" | "superadmin">("tenant");
  const [tenantSlug, setTenantSlug] = useState("kreatix-default");
  const [slugError, setSlugError] = useState<string | null>(null);
  const router = useRouter();

  const normalizedSlug = useMemo(() => normalizeTenantSlug(tenantSlug) || "", [tenantSlug]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSlugError(null);
    if (persona === "tenant") {
      if (!normalizedSlug) {
        setSlugError("Enter a tenant slug to continue");
        return;
      }
      // In local/dev flows we POST to /api/dev/session which sets cookies server-side
      // This is more reliable than client-side document.cookie for SSR layouts.
      // Use a server-side redirect endpoint to reliably set cookies then redirect
      if (typeof window !== "undefined") {
        if (process.env.NODE_ENV !== "production") {
          window.location.href = `/api/dev/session?tenantSlug=${encodeURIComponent(normalizedSlug)}&userId=dev-user-1&roleId=admin`;
        } else {
          try {
            document.cookie = `tenantSlug=${encodeURIComponent(normalizedSlug)}; path=/; samesite=lax`;
            document.cookie = `X-User-Id=dev-user-1; path=/; samesite=lax`;
            document.cookie = `X-Role-Id=admin; path=/; samesite=lax`;
          } catch (e) {
            // ignore cookie setting failures in restrictive browsers
          }
          window.location.href = `/tenant-admin?tenantSlug=${encodeURIComponent(normalizedSlug)}`;
        }
      }
      return;
    }
    // Full page navigation for superadmin too
    if (typeof window !== "undefined") window.location.href = "/superadmin";
  }

  return (
    <div className="relative min-h-screen bg-[#05060a] text-white">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-[#1ff0d8]/30 via-transparent to-transparent" />
        <div className="absolute left-10 bottom-[-120px] h-80 w-80 rounded-full blur-[150px]" style={{ background: "rgba(127, 91, 255, 0.35)" }} />
      </div>

      <main className="relative mx-auto flex max-w-5xl flex-col gap-10 px-6 py-14 lg:px-10">
        <header className="flex flex-col gap-6 rounded-[40px] border border-white/10 bg-black/30 p-8 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.45em] text-white/50">Unified access portal</p>
            <h1 className="text-4xl font-semibold tracking-tight">Choose your persona. Enter the mesh.</h1>
            <p className="max-w-2xl text-sm text-white/70 lg:text-base">
              Syspro routes every login through the neural policy layer. Tenants land inside their co-branded workspace. Superadmins gain observability without touching tenant secrets.
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-white/60">
              {steps.map((step, index) => (
                <div key={step.title} className="rounded-full border border-white/10 px-4 py-2">
                  <span className="text-white/40">{index + 1}. </span>
                  {step.title}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 text-sm text-white/70">
            <p className="text-xs uppercase tracking-[0.35em] text-white/50">Support</p>
            <p className="mt-3 text-base text-white">Need access approval?</p>
            <p className="mt-1">
              Email superadmin@syspro.ai or open a policy ticket from your tenant console.
            </p>
            <Link href="/" className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 hover:text-white">
              Return to marketing site
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        <section className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.4em] text-white/60">
              <Building2 className="h-4 w-4 text-teal-200" />
              Unified access
            </div>
            <div className="flex rounded-full border border-white/15 bg-black/30 p-1 text-xs font-semibold">
              {([
                { key: "tenant", label: "Tenant" },
                { key: "superadmin", label: "Superadmin" },
              ] as const).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setPersona(option.key)}
                  className={`rounded-full px-4 py-1.5 transition ${
                    persona === option.key ? "bg-white text-[#05060a]" : "text-white/60 hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <h2 className="mt-4 text-2xl font-semibold">{personas[persona].title}</h2>
          <p className="mt-2 text-sm text-white/70">{personas[persona].description}</p>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {persona === "tenant" && (
              <div>
                <label htmlFor="tenant" className="text-xs uppercase tracking-[0.35em] text-white/50">
                  Tenant slug
                </label>
                <input
                  id="tenant"
                  name="tenant"
                  value={tenantSlug}
                  onChange={(event) => setTenantSlug(event.target.value)}
                  placeholder="e.g. tembea-steel"
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
                />
                {slugError && <p className="mt-2 text-xs text-rose-300">{slugError}</p>}
              </div>
            )}
            <div>
              <label htmlFor="email" className="text-xs uppercase tracking-[0.35em] text-white/50">
                Work email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder={persona === "tenant" ? "you@company.com" : "root@syspro.com"}
                className="mt-2 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="password" className="text-xs uppercase tracking-[0.35em] text-white/50">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                className="mt-2 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
              />
            </div>
            {persona === "tenant" && (
              <div className="flex items-center gap-3 text-xs text-white/60">
                <input type="checkbox" id="remember" className="h-4 w-4 rounded border-white/30 bg-transparent" />
                <label htmlFor="remember">Remember device for 30 days</label>
              </div>
            )}
            <div className="rounded-2xl border border-white/15 bg-black/30 p-4 text-xs text-white/60">
              {persona === "tenant"
                ? `We’ll route you to /tenant-admin with ?tenantSlug=${normalizedSlug || "<required>"}.`
                : personas[persona].helper}
            </div>
            <button type="submit" className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-[#05060a]">
              {personas[persona].cta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </form>
        </section>

        <section className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur">
          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-white/50">
                <UserCircle className="h-4 w-4 text-sky-200" />
                Personas
              </div>
              <p className="mt-2 text-sm text-white/70">
                Planner, supplier, finance, ESG, and treasury personas each receive contextual navigation, feature toggles, and audit scopes.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-white/50">
                <KeySquare className="h-4 w-4 text-amber-200" />
                Policies
              </div>
              <p className="mt-2 text-sm text-white/70">
                Step-up authentication for high-risk tasks, tenant-bound data egress policies, and emergency kill-switch flows.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-white/50">
                <Shield className="h-4 w-4 text-emerald-200" />
                Observability
              </div>
              <p className="mt-2 text-sm text-white/70">
                Every session is mirrored to the compliance twin with replayable trails for auditors and regulators.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
