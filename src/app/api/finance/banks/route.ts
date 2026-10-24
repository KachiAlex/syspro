export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { sql as SQL } from "@/lib/sql-client";
import { getBanksForCountry, normalizeCountryCode } from "@/lib/banks";
import { getDefaultBranchId } from "@/lib/finance/branches";
import { getGatewayConfig } from "@/lib/finance/gateway-providers";
import { requireModuleAccess } from "@/lib/api-auth";

/**
 * Resolve the tenant's operating country for the bank directory:
 * default branch country -> statutory profile country -> NG fallback.
 */
async function resolveTenantCountryCode(tenantSlug: string): Promise<string> {
  try {
    const defaultBranchId = await getDefaultBranchId(tenantSlug);
    const rows = defaultBranchId
      ? await SQL`select country from tenant_branches where tenant_slug = ${tenantSlug} and id = ${defaultBranchId} limit 1`
      : await SQL`select country from tenant_branches where tenant_slug = ${tenantSlug} and status = 'active' and country is not null limit 5`;
    for (const row of rows as { country: string | null }[]) {
      const code = normalizeCountryCode(row.country);
      if (code) return code;
    }
  } catch {
    // branches unavailable — fall through
  }
  try {
    const profiles = await SQL`select country_code from admin_statutory_profiles where tenant_slug = ${tenantSlug} limit 1`;
    const code = normalizeCountryCode((profiles as { country_code: string }[])[0]?.country_code);
    if (code) return code;
  } catch {
    // no statutory profile — fall through
  }
  return "NG";
}

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;

  const tenantSlug = new URL(request.url).searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  const countryCode = await resolveTenantCountryCode(tenantSlug);
  const banks = getBanksForCountry(countryCode);

  // Account-name lookup is only possible when the tenant has an active
  // Paystack gateway config supplying the secret key.
  let resolvable = false;
  try {
    const cfg = await getGatewayConfig(tenantSlug, "paystack");
    resolvable = Boolean(cfg?.secret_key);
  } catch {
    resolvable = false;
  }

  return NextResponse.json({ countryCode, banks, resolvable });
}
