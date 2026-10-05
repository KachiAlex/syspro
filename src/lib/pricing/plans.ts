import { sql as SQL, SqlClient } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";

export type PricingPlan = {
  id?: number;
  key: string;
  name: string;
  tagline: string;
  price_label: string | null;
  price_monthly: number | null;
  price_annual: number | null;
  currency: string;
  period_label: string;
  max_users: number | null;
  features: string[];
  cta_label: string;
  cta_href: string;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
};

// Used to seed the table and as a render fallback if the DB is unavailable.
export const DEFAULT_PLANS: PricingPlan[] = [
  {
    key: "free",
    name: "Free",
    tagline: "For solo founders and tiny teams getting organised.",
    price_label: "Free",
    price_monthly: 0,
    price_annual: 0,
    currency: "NGN",
    period_label: "forever",
    max_users: 3,
    features: [
      "Up to 3 users",
      "Invoicing & expense tracking",
      "CRM contacts & pipeline",
      "Standard reports",
      "Community support",
    ],
    cta_label: "Start free",
    cta_href: "/signup",
    is_featured: false,
    is_active: true,
    sort_order: 0,
  },
  {
    key: "starter",
    name: "Starter",
    tagline: "For small teams that need finance and CRM in one place.",
    price_label: null,
    price_monthly: 9500,
    price_annual: 95000,
    currency: "NGN",
    period_label: "/month",
    max_users: 10,
    features: [
      "Up to 10 users",
      "CRM, Finance & basic HR",
      "Smart approvals",
      "Live P&L and cash flow",
      "Email support",
    ],
    cta_label: "Start free trial",
    cta_href: "/signup",
    is_featured: false,
    is_active: true,
    sort_order: 1,
  },
  {
    key: "growth",
    name: "Growth",
    tagline: "For businesses that run on automation.",
    price_label: null,
    price_monthly: 35000,
    price_annual: 350000,
    currency: "NGN",
    period_label: "/month",
    max_users: 50,
    features: [
      "Up to 50 users",
      "All modules: CRM, Finance, HR, Inventory, Projects",
      "Automation workflows & smart approvals",
      "≈ ₦700/user at full seats — a fraction of Odoo or Zoho",
      "Priority support",
    ],
    cta_label: "Start free trial",
    cta_href: "/signup",
    is_featured: true,
    is_active: true,
    sort_order: 2,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    tagline: "For multi-branch and regulated teams.",
    price_label: "Custom",
    price_monthly: null,
    price_annual: null,
    currency: "NGN",
    period_label: "",
    max_users: null,
    features: [
      "Unlimited users & branches",
      "Custom roles & access control",
      "Dedicated success manager",
      "SLA-backed support",
      "Onboarding & data migration",
    ],
    cta_label: "Talk to us",
    cta_href: "/support",
    is_featured: false,
    is_active: true,
    sort_order: 3,
  },
];

export function ensurePricingTable(...args: Parameters<typeof ensurePricingTableRun>) {
  return ensureOnce("pricing/plans:ensurePricingTable", () => ensurePricingTableRun(...args));
}

async function ensurePricingTableRun(sql: SqlClient) {
  await sql`
    create table if not exists pricing_plans (
      id serial primary key,
      key text unique not null,
      name text not null,
      tagline text,
      price_label text,
      price_monthly numeric(12,2),
      price_annual numeric(12,2),
      currency text default 'NGN',
      period_label text default '/month',
      max_users integer,
      features jsonb default '[]'::jsonb,
      cta_label text default 'Get started',
      cta_href text default '/signup',
      is_featured boolean default false,
      is_active boolean default true,
      sort_order integer default 0,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  // Seed defaults only when the table is completely empty.
  const count = await sql`select count(*)::int as n from pricing_plans`;
  if (Number(count[0]?.n ?? 0) > 0) return;

  for (const p of DEFAULT_PLANS) {
    await sql`
      insert into pricing_plans (
        key, name, tagline, price_label, price_monthly, price_annual,
        currency, period_label, max_users, features, cta_label, cta_href,
        is_featured, is_active, sort_order
      ) values (
        ${p.key}, ${p.name}, ${p.tagline}, ${p.price_label}, ${p.price_monthly},
        ${p.price_annual}, ${p.currency}, ${p.period_label}, ${p.max_users},
        ${JSON.stringify(p.features)}::jsonb, ${p.cta_label}, ${p.cta_href},
        ${p.is_featured}, ${p.is_active}, ${p.sort_order}
      )
      on conflict (key) do nothing
    `;
  }
}

// Public read — active plans only, with a hardcoded fallback so the pricing
// page still renders if the database is unavailable.
export async function getPricingPlans(): Promise<PricingPlan[]> {
  try {
    await ensurePricingTable(SQL);
    const rows = (await SQL`
      select * from pricing_plans
      where is_active = true order by sort_order asc, id asc
    `) as any[];
    return rows.length > 0 ? rows.map(normalizePlan) : DEFAULT_PLANS;
  } catch {
    return DEFAULT_PLANS;
  }
}

export async function getAllPricingPlans(): Promise<PricingPlan[]> {
  await ensurePricingTable(SQL);
  const rows = (await SQL`
    select * from pricing_plans order by sort_order asc, id asc
  `) as any[];
  return rows.map(normalizePlan);
}

function normalizePlan(r: any): PricingPlan {
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    tagline: r.tagline ?? "",
    price_label: r.price_label ?? null,
    price_monthly: r.price_monthly === null || r.price_monthly === undefined ? null : Number(r.price_monthly),
    price_annual: r.price_annual === null || r.price_annual === undefined ? null : Number(r.price_annual),
    currency: r.currency ?? "NGN",
    period_label: r.period_label ?? "/month",
    max_users: r.max_users ?? null,
    features: Array.isArray(r.features) ? r.features : [],
    cta_label: r.cta_label ?? "Get started",
    cta_href: r.cta_href ?? "/signup",
    is_featured: !!r.is_featured,
    is_active: !!r.is_active,
    sort_order: r.sort_order ?? 0,
  };
}
