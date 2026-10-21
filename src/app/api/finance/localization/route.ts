export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { listTaxRates } from "@/lib/finance/tax-management";
import { seedNigeriaPack } from "@/lib/finance/localization";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import { db } from "@/lib/sql-client";

/** Current localization state: tax rates + payroll statutory profile. */
export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  try {
    const [rates, profileRows] = await Promise.all([
      listTaxRates(context.tenantSlug),
      db.query<any>(
        `select country_code, paye_annualize, paye_relief, pension_employee_rate,
                pension_employer_rate, other_deductions, employer_contributions, tax_bands
         from admin_statutory_profiles where tenant_slug = $1`,
        [context.tenantSlug]
      ).then((r) => r.rows).catch(() => [] as any[]),
    ]);
    return NextResponse.json({
      country: profileRows[0]?.country_code ?? null,
      taxRates: rates,
      statutoryProfile: profileRows[0] ?? null,
      configured: rates.length > 0 || profileRows.length > 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const seedSchema = z.object({
  country: z.literal("NG").default("NG"),
});

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const gate = await requireModuleAccess(request, "finance", "write");
  if (!gate.ok) return gate.response;
  try {
    const parsed = seedSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Only the Nigeria (NG) pack is currently available", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const result = await seedNigeriaPack(context.tenantSlug);
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
