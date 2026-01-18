import Link from "next/link";
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

export default function AccessPage() {
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

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.4em] text-white/60">
              <Building2 className="h-4 w-4 text-teal-200" />
              Tenant workspace
            </div>
            <h2 className="mt-3 text-2xl font-semibold">Tenant &amp; partner login</h2>
            <p className="mt-2 text-sm text-white/70">
              Secure SSO for plant, finance, and supplier personas. We mint tenant-scoped tokens and enforce ledger isolation per click.
            </p>
            <form className="mt-6 space-y-4">
              <div>
                <label htmlFor="tenant" className="text-xs uppercase tracking-[0.35em] text-white/50">
                  Tenant slug
                </label>
                <input
                  id="tenant"
                  name="tenant"
                  placeholder="e.g. tembea-steel"
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="email" className="text-xs uppercase tracking-[0.35em] text-white/50">
                  Work email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-3 text-xs text-white/60">
                <input type="checkbox" id="remember" className="h-4 w-4 rounded border-white/30 bg-transparent" />
                <label htmlFor="remember">Remember device for 30 days</label>
              </div>
              <button type="button" className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-[#05060a]">
                Continue to tenant console
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <p className="text-xs text-white/50">Need supplier access? Ask your tenant admin to issue a burst invite.</p>
            </form>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-gradient-to-br from-[#1ff0d8]/10 via-white/0 to-white/5 p-8 backdrop-blur">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.4em] text-white/60">
              <Shield className="h-4 w-4 text-emerald-200" />
              Superadmin command
            </div>
            <h2 className="mt-3 text-2xl font-semibold">Superadmin login</h2>
            <p className="mt-2 text-sm text-white/70">
              Mint tenants, seed copilots, and audit policies. Hardware security keys + rotating passcodes required.
            </p>
            <form className="mt-6 space-y-4">
              <div>
                <label htmlFor="super-user" className="text-xs uppercase tracking-[0.35em] text-white/50">
                  Superadmin handle
                </label>
                <input
                  id="super-user"
                  name="super-user"
                  placeholder="syspro-root"
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="otp" className="text-xs uppercase tracking-[0.35em] text-white/50">
                  One-time passcode
                </label>
                <div className="mt-2 flex gap-3">
                  <input
                    id="otp"
                    name="otp"
                    placeholder="000000"
                    className="w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
                  />
                  <button type="button" className="rounded-2xl border border-white/20 px-4 py-3 text-xs uppercase tracking-[0.3em] text-white/70 hover:text-white">
                    Resend
                  </button>
                </div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-black/30 p-4 text-xs text-white/60">
                Insert hardware key when prompted. We notarize every superadmin action to the tenant trust ledger.
              </div>
              <button type="button" className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-[#05060a]">
                Launch superadmin mesh
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </form>
          </div>
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
