/**
 * Regional tax packs — a framework for one-click statutory setups beyond
 * Nigeria. Each pack defines tax templates, withholding categories, and
 * shipping defaults for a country; `applyTaxPack` upserts them into the
 * tenant's tax engine. Mirrors ERPNext's per-country tax fixtures
 * (south_africa_vat_account, india gst fixtures, etc.) — as data, not forks.
 */

import { sql as SQL } from "../sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { upsertTaxTemplate, upsertWithholdingCategory, upsertShippingRule } from "./tax-engine";

export type TaxPack = {
  code: string;                        // ISO-ish: 'GH', 'KE', 'ZA', 'NG'
  name: string;
  currency: string;
  taxTemplates: Array<{
    name: string; direction?: "sales" | "purchase" | "both";
    lines: Array<{ description?: string; rate: number; accountCode?: string }>;
  }>;
  withholding?: Array<{
    name: string; accountCode?: string;
    rates: Array<{ rate: number; singleThreshold?: number; cumulativeThreshold?: number }>;
  }>;
  shipping?: Array<{
    name: string; chargeType: "flat" | "percent"; chargeValue: number;
    minValue?: number; maxValue?: number; accountCode?: string;
  }>;
};

/**
 * Built-in packs. VAT figures are statutory headline rates as of 2026 —
 * tenants must verify current law; packs are starting points, not advice.
 */
export const TAX_PACKS: TaxPack[] = [
  {
    code: "GH", name: "Ghana", currency: "GHS",
    taxTemplates: [
      { name: "GH VAT 15% (incl. levies)", direction: "both", lines: [
        { description: "VAT", rate: 15, accountCode: "2205" },
      ]},
      { name: "GH NHIL+GETFund+COVID (on net)", direction: "both", lines: [
        { description: "NHIL", rate: 2.5, accountCode: "2205" },
        { description: "GETFund", rate: 2.5, accountCode: "2205" },
        { description: "COVID levy", rate: 1, accountCode: "2205" },
      ]},
    ],
    withholding: [
      { name: "GH WHT — Goods 3%", rates: [{ rate: 3 }] },
      { name: "GH WHT — Services 7.5%", rates: [{ rate: 7.5 }] },
      { name: "GH WHT — Rent 8%", rates: [{ rate: 8 }] },
    ],
  },
  {
    code: "KE", name: "Kenya", currency: "KES",
    taxTemplates: [
      { name: "KE VAT 16%", direction: "both", lines: [{ description: "VAT", rate: 16, accountCode: "2205" }] },
      { name: "KE VAT Exempt 0%", direction: "both", lines: [{ description: "VAT exempt", rate: 0, accountCode: "2205" }] },
    ],
    withholding: [
      { name: "KE WHT — Professional fees 5%", rates: [{ rate: 5 }] },
      { name: "KE WHT — Goods 2%", rates: [{ rate: 2 }] },
      { name: "KE WHT — Rent 7.5%", rates: [{ rate: 7.5 }] },
    ],
  },
  {
    code: "ZA", name: "South Africa", currency: "ZAR",
    taxTemplates: [
      { name: "ZA VAT 15%", direction: "both", lines: [{ description: "VAT", rate: 15, accountCode: "2205" }] },
      { name: "ZA VAT Zero-rated", direction: "both", lines: [{ description: "Zero-rated", rate: 0, accountCode: "2205" }] },
    ],
  },
  {
    code: "NG", name: "Nigeria", currency: "NGN",
    taxTemplates: [
      { name: "NG VAT 7.5%", direction: "both", lines: [{ description: "VAT", rate: 7.5, accountCode: "2205" }] },
    ],
    withholding: [
      { name: "NG WHT — Goods 5%", rates: [{ rate: 5 }] },
      { name: "NG WHT — Services 10%", rates: [{ rate: 10 }] },
      { name: "NG WHT — Rent/commission 10%", rates: [{ rate: 10 }] },
    ],
  },
];

export function ensureTaxPackTables() {
  return ensureOnce("finance/tax-packs:tables", run);
}

async function run() {
  const sql = SQL;
  await sql`create table if not exists tax_pack_applications (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    pack_code text not null,
    applied_by text,
    detail jsonb,
    created_at timestamptz not null default now(),
    unique (tenant_slug, pack_code)
  )`;
}

export function listTaxPacks() {
  return TAX_PACKS.map((p) => ({
    code: p.code, name: p.name, currency: p.currency,
    templates: p.taxTemplates.length,
    withholding: p.withholding?.length ?? 0,
  }));
}

/** Apply a pack: upserts templates + withholding + shipping into the engine. */
export async function applyTaxPack(input: {
  tenantSlug: string; packCode: string; userId?: string;
}) {
  const pack = TAX_PACKS.find((p) => p.code === input.packCode.toUpperCase());
  if (!pack) throw new Error(`Unknown tax pack '${input.packCode}'. Available: ${TAX_PACKS.map((p) => p.code).join(", ")}`);

  const detail: Record<string, unknown> = { templates: [], withholding: [], shipping: [] };
  for (const t of pack.taxTemplates) {
    (detail.templates as string[]).push(
      (await upsertTaxTemplate({ tenantSlug: input.tenantSlug, ...t }))?.name ?? t.name,
    );
  }
  for (const w of pack.withholding ?? []) {
    (detail.withholding as string[]).push(
      (await upsertWithholdingCategory({ tenantSlug: input.tenantSlug, ...w }))?.name ?? w.name,
    );
  }
  for (const s of pack.shipping ?? []) {
    (detail.shipping as string[]).push(
      (await upsertShippingRule({ tenantSlug: input.tenantSlug, ...s }))?.name ?? s.name,
    );
  }

  await ensureTaxPackTables();
  await SQL`
    insert into tax_pack_applications (tenant_slug, pack_code, applied_by, detail)
    values (${input.tenantSlug}, ${pack.code}, ${input.userId ?? null}, ${JSON.stringify(detail)}::jsonb)
    on conflict (tenant_slug, pack_code) do update
      set applied_by = excluded.applied_by, detail = excluded.detail, created_at = now()
  `;
  return { pack: pack.name, code: pack.code, ...detail };
}

export async function listAppliedPacks(tenantSlug: string) {
  await ensureTaxPackTables();
  return (await SQL`
    select pack_code, applied_by, detail, created_at::text
    from tax_pack_applications where tenant_slug = ${tenantSlug}
    order by created_at desc
  `) as any[];
}
