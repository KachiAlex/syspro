export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import { randomUUID } from "crypto";
import {
  validateTenantContext,
  errorResponse,
  checkRateLimit,
} from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";
import { seedNigeriaPack, ensureStatutoryProfileColumns } from "@/lib/finance/localization";

// Reference presets tenants can apply. "nigeria" delegates to seedNigeriaPack —
// the canonical annualized PAYE profile (annual bands + CRA + NHF + employer
// contributions). Do NOT inline monthly-scaled bands here: writing monthly
// bands while paye_annualize stays true produces ~12× over-taxation.
const PRESETS: Record<string, any> = {
  none: {
    label: "No statutory deductions",
    taxBands: [],
    pensionEmployeeRate: 0,
    pensionEmployerRate: 0,
    otherDeductions: [],
    payeAnnualize: false,
    payeRelief: null,
    employerContributions: [],
  },
  nigeria: {
    label: "Nigeria — PAYE + Pension + NHF (annualized)",
    delegatesTo: "seedNigeriaPack",
  },
};

const DEFAULT_PROFILE = {
  taxBands: [] as any[],
  pensionEmployeeRate: 8,
  pensionEmployerRate: 0,
  otherDeductions: [] as any[],
};

function normalizeProfile(row: any) {
  return {
    countryCode: row?.country_code ?? null,
    taxBands: row?.tax_bands ?? DEFAULT_PROFILE.taxBands,
    pensionEmployeeRate: row ? Number(row.pension_employee_rate) : DEFAULT_PROFILE.pensionEmployeeRate,
    pensionEmployerRate: row ? Number(row.pension_employer_rate) : DEFAULT_PROFILE.pensionEmployerRate,
    otherDeductions: row?.other_deductions ?? [],
    payeAnnualize: row?.paye_annualize ?? false,
    payeRelief: row?.paye_relief ?? null,
    employerContributions: row?.employer_contributions ?? [],
    updatedAt: row?.updated_at ?? null,
    updatedBy: row?.updated_by ?? null,
    isDefault: !row,
  };
}

async function getProfile(tenantSlug: string) {
  const rows = await sql`
    select * from admin_statutory_profiles where tenant_slug = ${tenantSlug}
  `;
  return normalizeProfile((rows as any[])[0]);
}

/**
 * GET /api/tenant/payroll/statutory — current statutory profile (or defaults)
 * plus available presets.
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");
    const _gate1 = await requireModuleGate(request, "people", "read");
    if (_gate1) return _gate1;
    if (!checkRateLimit(`statutory-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }
    await ensureHrTables(sql);
    const profile = await getProfile(context.tenantSlug);
    return NextResponse.json({ success: true, data: profile, presets: PRESETS });
  } catch (error) {
    console.error("Statutory profile GET error:", error);
    return errorResponse("Failed to load statutory profile", 500);
  }
}

/**
 * PUT /api/tenant/payroll/statutory
 * Body: { preset?: 'none'|'nigeria', countryCode?, taxBands?, pensionEmployeeRate?,
 *         pensionEmployerRate?, otherDeductions? }
 * Providing a preset seeds the fields; explicit fields override preset values.
 */
export async function PUT(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const _gate2 = await requireModuleGate(request, "people", "write");
    if (_gate2) return _gate2;
    if (!checkRateLimit(`statutory-put-${context.tenantSlug}`, 20, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }
    await ensureHrTables(sql);

    const body = await request.json().catch(() => ({}));
    const preset = typeof body?.preset === "string" ? PRESETS[body.preset] : undefined;
    if (body?.preset !== undefined && !preset) {
      return errorResponse(`Unknown preset '${body.preset}'. Available: ${Object.keys(PRESETS).join(", ")}`, 400);
    }

    // The nigeria preset delegates to the canonical seeder — one source of
    // truth for annualized PAYE bands, CRA relief, NHF and employer
    // contributions. This also clears any stale manual profile.
    if (body?.preset === "nigeria") {
      const seeded = await seedNigeriaPack(context.tenantSlug);
      const profile = await getProfile(context.tenantSlug);
      return NextResponse.json({ success: true, data: profile, seeded });
    }

    await ensureStatutoryProfileColumns();

    const taxBands = body?.taxBands ?? preset?.taxBands ?? [];
    if (!Array.isArray(taxBands)) return errorResponse("taxBands must be an array", 400);
    for (const b of taxBands) {
      if (typeof b?.rate !== "number" || b.rate < 0 || b.rate > 100) {
        return errorResponse("Each tax band needs a rate between 0 and 100", 400);
      }
      if (b.upTo !== null && b.upTo !== undefined && (typeof b.upTo !== "number" || b.upTo <= 0)) {
        return errorResponse("Tax band upTo must be a positive number or null (top bracket)", 400);
      }
    }

    const otherDeductions = body?.otherDeductions ?? preset?.otherDeductions ?? [];
    if (!Array.isArray(otherDeductions)) return errorResponse("otherDeductions must be an array", 400);
    for (const d of otherDeductions) {
      if (!d?.name || typeof d.name !== "string") {
        return errorResponse("Each statutory deduction needs a name", 400);
      }
      if (!["percent_of_gross", "fixed"].includes(d?.type)) {
        return errorResponse("Deduction type must be 'percent_of_gross' or 'fixed'", 400);
      }
      if (typeof d?.amount !== "number" || d.amount < 0) {
        return errorResponse("Deduction amount must be a non-negative number", 400);
      }
    }

    const pensionEmployeeRate = body?.pensionEmployeeRate ?? preset?.pensionEmployeeRate ?? 8;
    const pensionEmployerRate = body?.pensionEmployerRate ?? preset?.pensionEmployerRate ?? 0;
    for (const [label, v] of [["pensionEmployeeRate", pensionEmployeeRate], ["pensionEmployerRate", pensionEmployerRate]] as const) {
      if (typeof v !== "number" || v < 0 || v > 100) {
        return errorResponse(`${label} must be a percent between 0 and 100`, 400);
      }
    }

    // Extended fields are fully owned by this PUT — a manual profile write
    // resets them to neutral unless explicitly supplied, so a stale finance
    // tax-pack profile can't silently survive a UI edit (the 12× hazard).
    const payeAnnualize = body?.payeAnnualize === true;
    const payeRelief = body?.payeRelief ?? null;
    const employerContributions = Array.isArray(body?.employerContributions) ? body.employerContributions : [];

    const countryCode = body?.countryCode ?? null;
    const id = randomUUID();
    await sql`
      insert into admin_statutory_profiles
        (id, tenant_slug, country_code, tax_bands, pension_employee_rate, pension_employer_rate, other_deductions,
         paye_annualize, paye_relief, employer_contributions, updated_by)
      values
        (${id}, ${context.tenantSlug}, ${countryCode}, ${JSON.stringify(taxBands)}::jsonb,
         ${pensionEmployeeRate}, ${pensionEmployerRate}, ${JSON.stringify(otherDeductions)}::jsonb,
         ${payeAnnualize}, ${payeRelief === null ? null : JSON.stringify(payeRelief)}::jsonb,
         ${JSON.stringify(employerContributions)}::jsonb, ${context.userId})
      on conflict (tenant_slug) do update set
        country_code = excluded.country_code,
        tax_bands = excluded.tax_bands,
        pension_employee_rate = excluded.pension_employee_rate,
        pension_employer_rate = excluded.pension_employer_rate,
        other_deductions = excluded.other_deductions,
        paye_annualize = excluded.paye_annualize,
        paye_relief = excluded.paye_relief,
        employer_contributions = excluded.employer_contributions,
        updated_by = excluded.updated_by,
        updated_at = now()
    `;

    const profile = await getProfile(context.tenantSlug);
    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    console.error("Statutory profile PUT error:", error);
    return errorResponse("Failed to update statutory profile", 500);
  }
}
